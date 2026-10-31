for name in ['ui', 'electron']:
    settlements[name] = c.direct_edge_value(edges.get(name), secondary)
retain_focus_port(focus_port, proof, identities, settlements, forced, secondary)
result = c.envelope('cancel-inner-direct-complete' if primary is None and (not secondary) and (not forced) and all((c.direct_edge_clean(value) for value in settlements.values())) else 'cancel-inner-direct-adverse', schema=1, kind='MAINTAINED_DIRECT_INNER_V1', sourceSha256=source, primaryPresent=primary is not None, primary=None if primary is None else c.describe(primary), secondary=secondary, forced=forced, identities=identities, edgeOutcomes=settlements, proof=proof, scope='one initial-null genuine Cancel then normal Quit; positive MAIN projection is not raw renderer receipt; any forced retirement adverse')
if result['stage'] == 'cancel-inner-direct-complete':
    try:
        c.need(c.inner_direct_completion(result, source, identities['inner'], edges), 'FULL_DIRECT_INNER_COMPLETION')
    except BaseException as error:
        primary = error
        result.update(stage='cancel-inner-direct-adverse', primaryPresent=True, primary=c.describe(error))
try:
    c.write(c.OUT / 'inner-result.json', result)
except BaseException as error:
    secondary.append(dict(stage='inner-result-retention', error=c.describe(error)))
    print(json.dumps(c.envelope('inner-retention-adverse', primary=result['primary'], secondary=secondary)), file=sys.stderr, flush=True)
