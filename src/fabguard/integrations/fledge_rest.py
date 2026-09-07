"""Read-only client for pulling buffered readings from the Fledge REST API."""

from __future__ import annotations

import json
from collections.abc import Callable
from dataclasses import dataclass
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlsplit, urlunsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener


class FledgeRestError(RuntimeError):
    """Raised when the remote Fledge response is unsafe or violates its contract."""


class _RejectRedirects(HTTPRedirectHandler):
    """Keep credentials on the configured endpoint by rejecting every redirect."""

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


_NO_REDIRECT_OPENER = build_opener(_RejectRedirects())


def _open_without_redirects(request: Request, *, timeout: float):
    return _NO_REDIRECT_OPENER.open(request, timeout=timeout)


@dataclass(frozen=True)
class FledgeRestConfig:
    base_url: str
    auth_token: str | None = None
    timeout_seconds: float = 10.0
    max_response_bytes: int = 5_000_000


def _base_url(value: str) -> str:
    parsed = urlsplit(value.strip())
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise FledgeRestError("base_url must be an absolute http or https URL")
    if parsed.username or parsed.password or parsed.query or parsed.fragment:
        raise FledgeRestError("base_url must not contain credentials, a query, or a fragment")
    path = parsed.path.rstrip("/")
    return urlunsplit((parsed.scheme, parsed.netloc, path, "", ""))


def _read_limited(response, maximum: int) -> bytes:
    declared = response.headers.get("Content-Length")
    if declared is not None:
        try:
            if int(declared) > maximum:
                raise FledgeRestError("Fledge response exceeds max_response_bytes")
        except ValueError as error:
            raise FledgeRestError("Fledge returned an invalid Content-Length") from error
    payload = response.read(maximum + 1)
    if len(payload) > maximum:
        raise FledgeRestError("Fledge response exceeds max_response_bytes")
    return payload


def fetch_asset_readings(
    config: FledgeRestConfig,
    asset_code: str,
    *,
    limit: int = 20,
    opener: Callable[..., object] = _open_without_redirects,
) -> list[dict[str, object]]:
    """Fetch one asset's latest readings and adapt the official response envelope.

    The Fledge endpoint returns ``timestamp`` and ``reading`` but omits the asset
    code because it is carried in the URL. This function adds ``asset_code`` and
    maps ``timestamp`` to the local ``user_ts`` field without interpreting any
    measurement semantics.
    """

    base = _base_url(config.base_url)
    if not isinstance(asset_code, str) or not asset_code.strip():
        raise FledgeRestError("asset_code must be a non-empty string")
    if isinstance(limit, bool) or not isinstance(limit, int) or not 1 <= limit <= 10_000:
        raise FledgeRestError("limit must be an integer between 1 and 10000")
    if config.timeout_seconds <= 0 or config.max_response_bytes < 1:
        raise FledgeRestError("timeout and max_response_bytes must be positive")
    if config.auth_token is not None and not config.auth_token.strip():
        raise FledgeRestError("auth_token must be non-empty when provided")

    url = f"{base}/fledge/asset/{quote(asset_code.strip(), safe='')}?limit={limit}"
    headers = {"Accept": "application/json"}
    if config.auth_token is not None:
        headers["authorization"] = config.auth_token
    request = Request(url, headers=headers, method="GET")
    try:
        with opener(request, timeout=config.timeout_seconds) as response:
            payload = _read_limited(response, config.max_response_bytes)
    except FledgeRestError:
        raise
    except HTTPError as error:
        raise FledgeRestError(f"Fledge HTTP request failed with status {error.code}") from error
    except (URLError, OSError, TimeoutError) as error:
        raise FledgeRestError("Fledge REST endpoint is unavailable") from error

    try:
        decoded = json.loads(payload.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise FledgeRestError("Fledge response is not valid UTF-8 JSON") from error
    if not isinstance(decoded, list):
        raise FledgeRestError("Fledge asset endpoint must return a JSON array")

    adapted: list[dict[str, object]] = []
    for index, item in enumerate(decoded):
        if not isinstance(item, dict):
            raise FledgeRestError(f"Fledge reading[{index}] must be an object")
        timestamp = item.get("timestamp")
        reading = item.get("reading")
        if not isinstance(timestamp, str) or not isinstance(reading, dict):
            raise FledgeRestError(f"Fledge reading[{index}] requires timestamp and reading")
        # Fledge examples expose UTC storage timestamps without an offset. Make
        # that documented API convention explicit at this adapter boundary.
        normalized_timestamp = timestamp.strip()
        if normalized_timestamp and not (
            normalized_timestamp.endswith("Z")
            or "+" in normalized_timestamp[10:]
            or "-" in normalized_timestamp[10:]
        ):
            normalized_timestamp += "Z"
        adapted.append(
            {"asset_code": asset_code.strip(), "user_ts": normalized_timestamp, "reading": reading}
        )
    return adapted
