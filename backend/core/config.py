import yaml
from pathlib import Path
from typing import Any, Dict

_PATH = Path(__file__).parent.parent / "config" / "config.yaml"


def load() -> Dict[str, Any]:
    with open(_PATH) as f:
        return yaml.safe_load(f)


def save(data: Dict[str, Any]) -> None:
    with open(_PATH, "w") as f:
        yaml.dump(data, f, default_flow_style=False, sort_keys=False)
