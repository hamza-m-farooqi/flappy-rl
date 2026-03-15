from __future__ import annotations

import configparser
import json
from pathlib import Path
from typing import Any

import neat
from neat.graphs import feed_forward_layers


NEAT_CONFIG_PATH = Path(__file__).resolve().parent.parent.parent / "config" / "neat.cfg"
NEAT_OVERRIDES_FILENAME = "neat-overrides.json"

NEAT_PARAM_DEFINITIONS: dict[str, dict[str, Any]] = {
    "pop_size": {
        "section": "NEAT",
        "type": "int",
        "min": 10,
        "max": 500,
        "label": "Population Size",
        "description": "Birds evaluated in each generation.",
    },
    "conn_add_prob": {
        "section": "DefaultGenome",
        "type": "float",
        "min": 0.0,
        "max": 1.0,
        "label": "Connection Add Prob",
        "description": "Chance of adding a new connection mutation.",
    },
    "conn_delete_prob": {
        "section": "DefaultGenome",
        "type": "float",
        "min": 0.0,
        "max": 1.0,
        "label": "Connection Delete Prob",
        "description": "Chance of deleting an existing connection.",
    },
    "node_add_prob": {
        "section": "DefaultGenome",
        "type": "float",
        "min": 0.0,
        "max": 1.0,
        "label": "Node Add Prob",
        "description": "Chance of inserting a hidden node mutation.",
    },
    "node_delete_prob": {
        "section": "DefaultGenome",
        "type": "float",
        "min": 0.0,
        "max": 1.0,
        "label": "Node Delete Prob",
        "description": "Chance of removing a hidden node mutation.",
    },
    "weight_mutate_rate": {
        "section": "DefaultGenome",
        "type": "float",
        "min": 0.0,
        "max": 1.0,
        "label": "Weight Mutate Rate",
        "description": "Rate for mutating connection weights.",
    },
    "weight_mutate_power": {
        "section": "DefaultGenome",
        "type": "float",
        "min": 0.0,
        "max": 5.0,
        "label": "Weight Mutate Power",
        "description": "Magnitude of weight mutation perturbation.",
    },
    "bias_mutate_rate": {
        "section": "DefaultGenome",
        "type": "float",
        "min": 0.0,
        "max": 1.0,
        "label": "Bias Mutate Rate",
        "description": "Rate for mutating node biases.",
    },
    "compatibility_threshold": {
        "section": "DefaultSpeciesSet",
        "type": "float",
        "min": 0.5,
        "max": 10.0,
        "label": "Species Threshold",
        "description": "Distance threshold used for speciation.",
    },
    "survival_threshold": {
        "section": "DefaultReproduction",
        "type": "float",
        "min": 0.05,
        "max": 1.0,
        "label": "Survival Threshold",
        "description": "Fraction of each species allowed to reproduce.",
    },
}


def load_neat_config_parser() -> configparser.ConfigParser:
    """Load the canonical NEAT config as a mutable parser."""
    parser = configparser.ConfigParser()
    parser.optionxform = str
    parser.read(NEAT_CONFIG_PATH)
    return parser


def default_neat_overrides() -> dict[str, int | float]:
    """Return the default values for supported UI-editable NEAT parameters."""
    parser = load_neat_config_parser()
    defaults: dict[str, int | float] = {}
    for key, metadata in NEAT_PARAM_DEFINITIONS.items():
        raw_value = parser.get(metadata["section"], key)
        defaults[key] = _coerce_value(raw_value, metadata["type"])
    return defaults


def normalize_neat_overrides(
    overrides: dict[str, int | float] | None,
) -> dict[str, int | float]:
    """Validate, coerce, and trim incoming NEAT override values."""
    normalized: dict[str, int | float] = {}
    if not overrides:
        return normalized

    for key, value in overrides.items():
        metadata = NEAT_PARAM_DEFINITIONS.get(key)
        if metadata is None:
            raise ValueError(f"Unsupported NEAT parameter '{key}'.")

        normalized_value = _coerce_value(value, metadata["type"])
        minimum = metadata.get("min")
        maximum = metadata.get("max")
        if minimum is not None and normalized_value < minimum:
            raise ValueError(f"{key} must be at least {minimum}.")
        if maximum is not None and normalized_value > maximum:
            raise ValueError(f"{key} must be at most {maximum}.")

        default_value = default_neat_overrides()[key]
        if normalized_value != default_value:
            normalized[key] = normalized_value

    return normalized


def build_neat_config(
    config_path: Path,
    overrides: dict[str, int | float] | None = None,
    generated_dir: Path | None = None,
) -> neat.Config:
    """Build a NEAT config from disk, optionally applying run-specific overrides."""
    if not overrides:
        return neat.Config(
            neat.DefaultGenome,
            neat.DefaultReproduction,
            neat.DefaultSpeciesSet,
            neat.DefaultStagnation,
            str(config_path),
        )

    parser = load_neat_config_parser()
    for key, value in normalize_neat_overrides(overrides).items():
        metadata = NEAT_PARAM_DEFINITIONS[key]
        parser.set(metadata["section"], key, str(value))

    generated_path = (generated_dir or config_path.parent) / ".neat.generated.cfg"
    generated_path.parent.mkdir(parents=True, exist_ok=True)
    with generated_path.open("w", encoding="utf-8") as generated_file:
        parser.write(generated_file)

    return neat.Config(
        neat.DefaultGenome,
        neat.DefaultReproduction,
        neat.DefaultSpeciesSet,
        neat.DefaultStagnation,
        str(generated_path),
    )


def neat_overrides_path(run_directory: Path) -> Path:
    """Return the override metadata path for a training run."""
    return run_directory / NEAT_OVERRIDES_FILENAME


def save_neat_overrides(
    run_directory: Path,
    overrides: dict[str, int | float] | None,
) -> None:
    """Persist run-specific NEAT override values for admin visibility."""
    payload = normalize_neat_overrides(overrides)
    run_directory.mkdir(parents=True, exist_ok=True)
    neat_overrides_path(run_directory).write_text(
        json.dumps(payload, indent=2, sort_keys=True),
        encoding="utf-8",
    )


def load_neat_overrides(run_directory: Path) -> dict[str, int | float]:
    """Return persisted run-specific NEAT overrides, if present."""
    path = neat_overrides_path(run_directory)
    if not path.exists():
        return {}
    return normalize_neat_overrides(json.loads(path.read_text(encoding="utf-8")))


def serialize_network(
    genome: neat.DefaultGenome,
    config: neat.Config,
    values: dict[int, float] | None = None,
) -> dict[str, Any]:
    """Serialize a NEAT genome into a frontend-friendly graph payload."""
    enabled_connections = [
        connection for connection in genome.connections.values() if connection.enabled
    ]
    connection_keys = [connection.key for connection in enabled_connections]
    layers, required_nodes = feed_forward_layers(
        config.genome_config.input_keys,
        config.genome_config.output_keys,
        connection_keys,
    )

    node_layers: dict[int, int] = {
        node_id: 0 for node_id in config.genome_config.input_keys
    }
    for layer_index, layer_nodes in enumerate(layers, start=1):
        for node_id in layer_nodes:
            node_layers[node_id] = layer_index

    hidden_nodes = sorted(
        node_id
        for node_id in required_nodes
        if node_id not in config.genome_config.input_keys
        and node_id not in config.genome_config.output_keys
    )

    nodes: list[dict[str, Any]] = []
    for node_id in sorted(required_nodes):
        node_gene = genome.nodes.get(node_id)
        if node_id in config.genome_config.input_keys:
            node_type = "input"
            label = {
                config.genome_config.input_keys[0]: "Bird Y",
                config.genome_config.input_keys[1]: "Pipe Dist",
                config.genome_config.input_keys[2]: "Gap Top",
            }.get(node_id, f"Input {node_id}")
            bias = 0.0
            response = 1.0
        elif node_id in config.genome_config.output_keys:
            node_type = "output"
            label = "Jump"
            bias = float(node_gene.bias if node_gene is not None else 0.0)
            response = float(node_gene.response if node_gene is not None else 1.0)
        else:
            node_type = "hidden"
            label = f"H{hidden_nodes.index(node_id) + 1}"
            bias = float(node_gene.bias if node_gene is not None else 0.0)
            response = float(node_gene.response if node_gene is not None else 1.0)

        nodes.append(
            {
                "id": node_id,
                "label": label,
                "type": node_type,
                "layer": node_layers.get(node_id, 0),
                "bias": bias,
                "response": response,
                "activation": getattr(node_gene, "activation", "identity")
                if node_gene is not None
                else "identity",
                "value": float(values.get(node_id, 0.0)) if values else 0.0,
            }
        )

    connections: list[dict[str, Any]] = []
    for connection in sorted(enabled_connections, key=lambda item: item.innovation):
        source, target = connection.key
        source_value = float(values.get(source, 0.0)) if values else 0.0
        signal = source_value * float(connection.weight)
        connections.append(
            {
                "in": source,
                "out": target,
                "weight": float(connection.weight),
                "enabled": bool(connection.enabled),
                "innovation": int(connection.innovation),
                "signal": signal,
            }
        )

    return {
        "nodes": nodes,
        "connections": connections,
        "stats": {
            "node_count": len(nodes),
            "connection_count": len(connections),
            "hidden_count": sum(1 for node in nodes if node["type"] == "hidden"),
            "layer_count": max((node["layer"] for node in nodes), default=0) + 1,
        },
    }


def override_parameter_catalog() -> list[dict[str, Any]]:
    """Expose UI-editable NEAT parameter metadata to the admin page."""
    defaults = default_neat_overrides()
    return [
        {
            "key": key,
            "default": defaults[key],
            **metadata,
        }
        for key, metadata in NEAT_PARAM_DEFINITIONS.items()
    ]


def _coerce_value(value: Any, value_type: str) -> int | float:
    if value_type == "int":
        if isinstance(value, bool):
            raise ValueError("Boolean values are not valid here.")
        return int(value)
    if value_type == "float":
        if isinstance(value, bool):
            raise ValueError("Boolean values are not valid here.")
        return float(value)
    raise ValueError(f"Unsupported value type '{value_type}'.")
