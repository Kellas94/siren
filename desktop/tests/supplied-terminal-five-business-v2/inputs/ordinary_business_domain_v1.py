"""Declared business-domain view; no source-gate, IO or runtime authority."""
import json
import ordinary_direct_context as CX
import ordinary_direct_fixed_plan as P
import ordinary_external_profile_v1 as F

_ROLES=('owner','outer','inner','electron','ui')

def _need(ok,code):
    if ok is not True:raise ValueError('BUSINESS_DOMAIN_V1:'+code)

def _declared_pin(value,path):
    F._keys(value,('path','bytes','sha256'),'DECLARED_BUSINESS_PIN')
    _need(type(value['path']) is str and value['path']==path and
        type(value['bytes']) is int and 0<value['bytes']<=4*1024*1024 and F._hex(value['sha256'],64),
        'FIXED_TYPED_DECLARED_BUSINESS_PIN')

class _BusinessDomainContextV1:
    # These immutable local values authenticate neither the caller nor files.
    __slots__=('_context','_body','_header_body')

    def __init__(self,context,*,input_manifest_pin,controller_review_pin):
        _need(type(context) is CX._ExternalExpectedContext and context.source_identity_kind=='SIREN_EXTERNAL_SOURCE_PLAN_V1','EXACT_EXISTING_EXTERNAL_CONTEXT')
        _declared_pin(input_manifest_pin,P._ROOT+'\\INPUT-MANIFEST.json')
        _declared_pin(controller_review_pin,P._ROOT+'\\CONTROLLER-SOURCE-REVIEW.json')
        external_hashes={context.source_sha,context.review_sha}
        _need(input_manifest_pin['sha256'] not in external_hashes and controller_review_pin['sha256'] not in external_hashes,
            'NO_PARTIAL_EXTERNAL_IDENTITY_SUBSTITUTION')
        pair=dict(schema=1,kind='SIREN_SOURCE_DOMAIN_PAIR_V1',
            business=dict(kind='SIREN_INPUT_MANIFEST_V1',inputManifestPin=F._detach(input_manifest_pin),
                controllerReviewPin=F._detach(controller_review_pin),pinsDeclaredOnly=True),
            external=dict(kind=context.source_identity_kind,sourcePlanPin=F._detach(context.source_plan_pin),
                externalReviewPin=F._detach(context.review_pin),attemptHeaderPin=F._detach(context.header_pin)),
            roleBindings={name:context.role_binding(name) for name in _ROLES},
            wholeSourceGatePassed=False,nativeEligibility=False,sourceCustody=False,authenticatedTransport=False,wholeAttempt=False)
        self._context=context;self._header_body=context.header_body
        self._body=json.dumps(pair,sort_keys=True,separators=(',',':'),ensure_ascii=True,allow_nan=False).encode('ascii')
        self._validate()

    def _validate(self):
        value=F._load(self._body);external=value['external'];context=self._context
        _need(type(context) is CX._ExternalExpectedContext and context.source_identity_kind==external['kind'] and
            context.source_sha==external['sourcePlanPin']['sha256'] and context.review_sha==external['externalReviewPin']['sha256'] and
            F._same(context.source_plan_pin,external['sourcePlanPin']) and F._same(context.review_pin,external['externalReviewPin']) and
            F._same(context.header_pin,external['attemptHeaderPin']) and context.header_body==self._header_body and
            all(F._same(context.role_binding(name),value['roleBindings'][name]) for name in _ROLES),
            'ORIGINAL_EXTERNAL_SOURCE_HEADER_ROLE_IDENTITY')
        return value

    @property
    def source_sha(self):return self._validate()['business']['inputManifestPin']['sha256']
    @property
    def review_sha(self):return self._validate()['business']['controllerReviewPin']['sha256']
    @property
    def external_source_sha(self):return self._validate()['external']['sourcePlanPin']['sha256']
    @property
    def external_review_sha(self):return self._validate()['external']['externalReviewPin']['sha256']

    def binding(self,name):
        self._validate();return self._context.binding(name)

    def role_binding(self,name):
        self._validate();return self._context.role_binding(name)

    def binding_matches(self,name,value):
        try:
            self._validate();return self._context.binding_matches(name,value)
        except (ValueError,TypeError,KeyError):return False

    def snapshot(self):return self._validate()
