"""Read-only prototype: validate DECLARED cohort/budget contracts before saved-table comparison.
Never infer eligibility, approve policy, authenticate evidence or infer models.
"""
import argparse
import csv
import hashlib
import types
import json
from pathlib import Path

SOURCE_COMMIT = '066ec0b8f30a2e9512224e44e0fe72b0219b64f1'
SOURCE_SHA256 = 'c8197c057663ba0ad5dad77e25531bd2d6f81115dd38ba4890ca0d06f2429d61'
BOUNDARY = ('Declared-contract and saved-output agreement only. No eligibility truth, '
            'evidence authenticity, prespecification timing, policy approval, model inference, '
            'independent performance or factory readiness is established.')

class ContractError(ValueError): pass

def require(condition, message):
    if not condition: raise ContractError(message)

def strict_object(pairs):
    out = {}
    for key, value in pairs:
        require(key not in out, 'duplicate JSON key: '+key)
        out[key] = value
    return out

def read_contract(path):
    raw = Path(path).read_bytes()
    def bad_constant(value): raise ContractError('non-finite JSON constant: '+value)
    contract = json.loads(raw, object_pairs_hook=strict_object, parse_constant=bad_constant)
    return validate_contract(contract), hashlib.sha256(raw).hexdigest()

def keys(value, expected, label):
    require(type(value) is dict and set(value) == set(expected), 'invalid '+label+' fields')

def nonempty(value, label):
    require(type(value) is str and bool(value.strip()) and value == value.strip(), 'invalid '+label)
    return value

def integer(value, label):
    require(type(value) is int and value > 0, 'invalid '+label)
    return value

def ids(value, label, allow_empty=False):
    require(type(value) is list and (allow_empty or len(value)>0), 'invalid '+label)
    for item in value: nonempty(item, label+' ID')
    require(len(value)==len(set(value)), 'duplicate '+label+' ID')
    return set(value)

def validate_contract(c):
    keys(c, ['schema','snapshot_sha256','original_ids','eligible_ids','held','budget','declared_k'], 'contract')
    require(c['schema']=='fabguard.declared-budget-contract.v1', 'unsupported schema')
    sha=c['snapshot_sha256']
    require(type(sha) is str and len(sha)==64 and all(ch in '0123456789abcdef' for ch in sha), 'invalid snapshot SHA-256')
    original=ids(c['original_ids'],'original'); eligible=ids(c['eligible_ids'],'eligible')
    require(type(c['held']) is list, 'held must be a list')
    held={}
    for row in c['held']:
        keys(row,['sample_id','reason','evidence_state','evidence_reference'],'held row')
        identity=nonempty(row['sample_id'],'held ID');require(identity not in held,'duplicate held ID')
        nonempty(row['reason'],'held reason')
        require(row['evidence_state'] in ['original_record','operator_statement','reconstructed','unknown'], 'invalid evidence state')
        nonempty(row['evidence_reference'],'evidence reference')
        held[identity]=dict(row)
    require(not eligible.intersection(held), 'eligible and held overlap')
    require(original==eligible.union(held), 'original != eligible + held partition')
    b=c['budget'];require(type(b) is dict,'budget must be an object')
    if b.get('mode')=='fixed_count':
        keys(b,['mode','count'],'fixed budget'); expected=integer(b['count'],'fixed count')
    elif b.get('mode')=='fraction':
        keys(b,['mode','basis','numerator','denominator','rounding'],'fraction budget')
        require(b['basis'] in ['original','eligible'],'invalid budget basis')
        numerator=integer(b['numerator'],'fraction numerator');denominator=integer(b['denominator'],'fraction denominator')
        require(numerator<=denominator,'fraction exceeds one')
        require(b['rounding']=='ceil','only explicit ceil is supported')
        population=len(original) if b['basis']=='original' else len(eligible)
        expected=(population*numerator+denominator-1)//denominator
    else: raise ContractError('unsupported budget mode')
    require(integer(c['declared_k'],'declared K')==expected,'declared K differs from budget rule')
    require(expected<=len(eligible),'budget exceeds eligible rows; no implicit clamping')
    # Order-independent IDs, order-independent held records; metadata remains exact.
    return dict(schema=c['schema'],snapshot_sha256=sha,original_ids=sorted(original),
                eligible_ids=sorted(eligible),held=[held[k] for k in sorted(held)],
                budget=dict(b),declared_k=expected)

def load_comparator():
    path=Path(__file__).parent/'compare_priority_runs.py'
    raw = path.read_bytes()
    require(hashlib.sha256(raw).hexdigest()==SOURCE_SHA256,'comparator SHA mismatch')
    # Execute precisely the bytes checked above; never reopen the path after hashing.
    module = types.ModuleType('fixed_fabguard_comparator')
    module.__file__ = str(path)
    exec(compile(raw, str(path), 'exec'), module.__dict__)
    return module

def gated_compare(reference, actual, reference_contract, actual_contract, *, score_atol):
    left,lh=read_contract(reference_contract);right,rh=read_contract(actual_contract)
    require(left==right,'declared contracts differ; do not compare budgets or cohorts')
    comparator=load_comparator()
    a,ah=comparator.read_table(reference);b,bh=comparator.read_table(actual)
    require(set(a)==set(left['eligible_ids']),'reference table differs from declared eligible IDs')
    require(set(b)==set(right['eligible_ids']),'actual table differs from declared eligible IDs')
    report=comparator.compare(reference,actual,score_atol=score_atol,top_k=left['declared_k'])
    require(report['input_sha256']=={'reference':ah,'actual':bh},'table changed between eligibility check and comparison')
    return {'schema':'fabguard.declared-budget-gate.v1','status':report['status'],
            'declared_contract_check':'consistent','original_count':len(left['original_ids']),
            'eligible_count':len(left['eligible_ids']),'held_count':len(left['held']),
            'budget':left['budget'],'top_k':left['declared_k'],
            'contract_sha256':{'reference':lh,'actual':rh},
            'comparator_source_commit':SOURCE_COMMIT,'comparator_sha256':SOURCE_SHA256,
            'saved_output_comparison':report,'claim_boundary':BOUNDARY,
            'eligibility_truth_verified':False,'prespecification_timing_verified':False,
            'evidence_authenticity_verified':False,'factory_readiness_verified':False}

def main():
    p=argparse.ArgumentParser(description=__doc__)
    for field in ['reference','actual','reference-contract','actual-contract']:
        p.add_argument('--'+field,type=Path,required=True)
    p.add_argument('--score-atol',type=float,required=True)
    a=p.parse_args()
    try:
        r=gated_compare(a.reference,a.actual,a.reference_contract,a.actual_contract,score_atol=a.score_atol)
    except (OSError,UnicodeError,ValueError,TypeError,csv.Error) as e:
        print(json.dumps({'schema':'fabguard.declared-budget-gate.v1','status':'BLOCKED','reason':str(e),'claim_boundary':BOUNDARY},ensure_ascii=False))
        return 2
    print(json.dumps(r,ensure_ascii=False,indent=2,allow_nan=False))
    return 0 if r['status']=='MATCH' else 1

if __name__=='__main__':raise SystemExit(main())
