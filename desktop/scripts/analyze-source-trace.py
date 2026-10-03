"""Read an owned Chromium trace; do not execute or alter the captured source."""
import collections
import json
import pathlib
import sys

root = pathlib.Path(sys.argv[1]).resolve()
events = json.loads((root / "trace.json").read_text(encoding="utf-8"))["traceEvents"]
groups = {}
for event in events:
    if event.get("name") != "ProfileChunk":
        continue
    key = (event["pid"], event["tid"], event.get("id"))
    group = groups.setdefault(key, {"nodes": {}, "samples": []})
    data = event["args"]["data"]
    profile = data.get("cpuProfile", {})
    group["nodes"].update({node["id"]: node for node in profile.get("nodes", [])})
    samples, deltas = profile.get("samples", []), data.get("timeDeltas", [])
    if len(samples) != len(deltas):
        raise ValueError("Incomplete CPU sample/delta alignment")
    group["samples"].extend(zip(samples, deltas))

processes = []
for key, group in groups.items():
    own, inclusive = collections.Counter(), collections.Counter()
    frames = {}
    for node_id, duration in group["samples"]:
        seen = set()
        current = node_id
        while current in group["nodes"] and current not in seen:
            seen.add(current)
            node = group["nodes"][current]
            frame = node["callFrame"]
            label = (frame.get("functionName", ""), frame.get("url", ""), frame.get("lineNumber", -1) + 1)
            frames[label] = dict(function=label[0], url=label[1], line=label[2])
            inclusive[label] += duration
            if current == node_id:
                own[label] += duration
            current = node.get("parent")
    top = lambda counter: [dict(frames[label], sampledMs=round(us / 1000, 3)) for label, us in counter.most_common(25)]
    processes.append(dict(pid=key[0], tid=key[1], profile=key[2], sampledMs=round(sum(own.values()) / 1000, 3), exclusive=top(own), inclusive=top(inclusive)))

timeline = collections.defaultdict(lambda: collections.Counter())
for event in events:
    if event.get("ph") == "X" and "dur" in event:
        timeline[event["pid"]][event["name"]] += event["dur"]
samples = [json.loads(line) for line in (root / "process-metrics.jsonl").read_text(encoding="utf-8").splitlines()]
peak = max(samples, key=lambda sample: sum(p.get("memory", {}).get("workingSetSize", 0) for p in sample["processes"]))
result = dict(scope="Coordinator-authored analysis of one failed native input probe; sampled CPU is diagnostic, not a complete wall-clock attribution", traceEvents=len(events), cpu=processes, timeline=[dict(pid=pid, durationMs={name: round(us / 1000, 3) for name, us in counts.most_common(15)}) for pid, counts in timeline.items()], memorySamples=len(samples), peakWorkingSetKiB=sum(p.get("memory", {}).get("workingSetSize", 0) for p in peak["processes"]), peakSnapshot=peak)
(root / "trace-analysis.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
print(json.dumps(dict(cpu=[dict(pid=p["pid"], sampledMs=p["sampledMs"], exclusive=p["exclusive"][:8], inclusive=p["inclusive"][:8]) for p in processes], peakWorkingSetMiB=round(result["peakWorkingSetKiB"] / 1024, 2)), indent=2))
