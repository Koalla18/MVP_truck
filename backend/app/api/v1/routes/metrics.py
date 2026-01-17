"""Metrics endpoint for Prometheus."""

from fastapi import APIRouter
from datetime import datetime, timezone
import os

router = APIRouter()

# Simple in-memory metrics
_metrics = {
    "requests_total": 0,
    "errors_total": 0,
    "start_time": datetime.now(timezone.utc).isoformat()
}


def increment_requests():
    _metrics["requests_total"] += 1


def increment_errors():
    _metrics["errors_total"] += 1


@router.get("/metrics")
def get_metrics():
    """Prometheus-compatible metrics endpoint."""
    
    uptime_seconds = (datetime.now(timezone.utc) - datetime.fromisoformat(_metrics["start_time"])).total_seconds()
    
    # Prometheus text format
    output = []
    output.append(f"# HELP routox_requests_total Total HTTP requests")
    output.append(f"# TYPE routox_requests_total counter")
    output.append(f'routox_requests_total {_metrics["requests_total"]}')
    
    output.append(f"# HELP routox_errors_total Total errors")
    output.append(f"# TYPE routox_errors_total counter")
    output.append(f'routox_errors_total {_metrics["errors_total"]}')
    
    output.append(f"# HELP routox_uptime_seconds Uptime in seconds")
    output.append(f"# TYPE routox_uptime_seconds gauge")
    output.append(f"routox_uptime_seconds {uptime_seconds:.0f}")
    
    output.append(f"# HELP routox_info Application info")
    output.append(f"# TYPE routox_info gauge")
    output.append(f'routox_info{{version="1.0.0",env="{os.getenv("ENV", "dev")}"}} 1')
    
    return "\n".join(output)


@router.get("/metrics/json")
def get_metrics_json():
    """JSON metrics for easy debugging."""
    uptime_seconds = (datetime.now(timezone.utc) - datetime.fromisoformat(_metrics["start_time"])).total_seconds()
    
    return {
        "requests_total": _metrics["requests_total"],
        "errors_total": _metrics["errors_total"],
        "uptime_seconds": round(uptime_seconds),
        "start_time": _metrics["start_time"],
        "version": "1.0.0",
        "env": os.getenv("ENV", "dev")
    }
