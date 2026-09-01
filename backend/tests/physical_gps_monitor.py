"""Monitor de evidencia para pruebas físicas; no imprime coordenadas ni credenciales."""

import argparse
import json
import time
from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID

from sqlalchemy import select

from app.core.database import SessionLocal
from app.models.entrega_models import Entrega
from app.models.seguimiento_ubicacion_models import SeguimientoUbicacion


def snapshot(delivery_id: UUID) -> dict:
    with SessionLocal() as db:
        rows = db.execute(
            select(SeguimientoUbicacion).where(
                SeguimientoUbicacion.entrega_id == delivery_id
            ).order_by(SeguimientoUbicacion.registrada_en)
        ).scalars().all()
        delivery = db.get(Entrega, delivery_id)
        if delivery is None:
            raise SystemExit("La entrega indicada no existe.")
        return {
            "count": len(rows),
            "ids": [str(row.client_point_id) for row in rows],
            "timestamps": [row.registrada_en for row in rows],
            "accuracies": [float(row.precision_m) if row.precision_m is not None else None for row in rows],
            "distance_m": float(delivery.distancia_recorrida_m or 0),
        }


def main() -> None:
    parser = argparse.ArgumentParser(description="Registra evidencia segura de una prueba GPS física.")
    parser.add_argument("--delivery-id", required=True, type=UUID)
    parser.add_argument("--minutes", type=float, default=10)
    parser.add_argument("--minimum-new-points", type=int, default=2)
    parser.add_argument("--label", default="prueba_fisica")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    if not 0 < args.minutes <= 480:
        raise SystemExit("--minutes debe estar entre 0 y 480.")

    started_at = datetime.now(timezone.utc)
    initial = snapshot(args.delivery_id)
    print(f"MONITOR_STARTED label={args.label} baseline={initial['count']}", flush=True)
    deadline = time.monotonic() + args.minutes * 60
    while time.monotonic() < deadline:
        time.sleep(min(10, max(0.1, deadline - time.monotonic())))

    final = snapshot(args.delivery_id)
    new_timestamps = final["timestamps"][initial["count"]:]
    intervals = [
        round((later - earlier).total_seconds(), 1)
        for earlier, later in zip(new_timestamps, new_timestamps[1:])
    ]
    new_accuracies = [
        value for value in final["accuracies"][initial["count"]:] if value is not None
    ]
    new_points = final["count"] - initial["count"]
    report = {
        "label": args.label,
        "delivery_id": str(args.delivery_id),
        "started_at_utc": started_at.isoformat(),
        "finished_at_utc": datetime.now(timezone.utc).isoformat(),
        "duration_minutes": args.minutes,
        "baseline_points": initial["count"],
        "final_points": final["count"],
        "new_points": new_points,
        "all_client_ids_unique": len(final["ids"]) == len(set(final["ids"])),
        "all_points_ordered": final["timestamps"] == sorted(final["timestamps"]),
        "new_intervals_seconds": intervals,
        "minimum_accuracy_m": round(min(new_accuracies), 1) if new_accuracies else None,
        "maximum_accuracy_m": round(max(new_accuracies), 1) if new_accuracies else None,
        "distance_added_m": round(final["distance_m"] - initial["distance_m"], 1),
        "result": "evidence_collected" if new_points >= args.minimum_new_points else "inconclusive",
        "note": (
            "El resultado sólo prueba el escenario si se documentaron también las acciones físicas, "
            "permisos, estado de pantalla y red del dispositivo."
        ),
    }
    serialized = json.dumps(report, ensure_ascii=False, indent=2)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(serialized + "\n", encoding="utf-8")
    print(serialized)


if __name__ == "__main__":
    main()
