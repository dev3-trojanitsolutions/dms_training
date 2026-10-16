"""The list of simulated screens and the elements a step can point at.

`screens.json` is shared with the frontend, which renders one Vue component per
screen key. A target is either a fixed id (`order.submit`) or a pattern with a
placeholder (`order.add:{item_code}`), which a step fills in (`order.add:PEN-BLU-01`).
"""

import json
from functools import cache
from pathlib import Path

REGISTRY_PATH = Path(__file__).parent / "screens.json"


@cache
def load_registry() -> dict:
	return json.loads(REGISTRY_PATH.read_text())


def screen_targets(screen: str) -> dict[str, str]:
	"""Return `{target pattern: label}` for a screen, shared groups included."""
	registry = load_registry()
	spec = registry["screens"].get(screen)
	if not spec:
		return {}
	targets = {}
	for group in spec.get("include", []):
		targets.update(registry["groups"].get(group, {}))
	targets.update(spec.get("targets", {}))
	return targets


def is_known_screen(screen: str) -> bool:
	return screen in load_registry()["screens"]


def is_known_target(screen: str, target: str) -> bool:
	"""Match on the part before `:`, so any value can fill a placeholder."""
	prefix, has_value, _value = target.partition(":")
	for pattern in screen_targets(screen):
		pattern_prefix, pattern_has_value, _ = pattern.partition(":")
		if pattern_prefix == prefix and bool(pattern_has_value) == bool(has_value):
			return True
	return False
