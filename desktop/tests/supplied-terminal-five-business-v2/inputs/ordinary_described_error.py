"""Private exact described-error closure; no new raw decoder."""
def _desc_fail(code):
    raise ValueError(code)


def _desc_refuse():
    _desc_fail('DESCRIBED_ERROR_DATA_SCHEMA_REFUSED')


def _desc_description(value):
    required = {'type', 'message'}
    allowed = required | {'notes', 'notesTruncated', 'notesUnavailable'}
    if type(value) is not dict or not required <= set(value) <= allowed:
        _desc_refuse()
    if type(value['type']) is not str:
        _desc_refuse()
    if type(value['message']) is not str:
        _desc_refuse()
    notes = []
    if 'notes' in value:
        source = value['notes']
        if type(source) is not list or not 1 <= len(source) <= 4:
            _desc_refuse()
        for note in source:
            if type(note) is not str or len(note) > 4096:
                _desc_refuse()
            notes.append(note)
    for flag in ('notesTruncated', 'notesUnavailable'):
        if flag in value and value[flag] is not True:
            _desc_refuse()
    truncated = 'notesTruncated' in value
    unavailable = 'notesUnavailable' in value
    count = len(notes)
    if truncated and count == 0 and (not unavailable):
        _desc_refuse()
    if unavailable and count > 3:
        _desc_refuse()
    if truncated and (not unavailable) and (count == 0 or (count != 4 and (not any((len(note) == 4096 for note in notes))))):
        _desc_refuse()
    copied = dict(type=value['type'], message=value['message'])
    if 'notes' in value:
        copied['notes'] = notes
    if truncated:
        copied['notesTruncated'] = True
    if unavailable:
        copied['notesUnavailable'] = True
    return copied


