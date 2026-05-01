from __future__ import annotations

from datetime import datetime
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.core.database import SessionLocal
from app.services.reminders import send_reminders

SCHEDULE_DAYS = (7, 3, 1, 0)


def main() -> int:
    started_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{started_at}] Reminder job started")

    db = SessionLocal()
    try:
        total_candidates = 0
        total_sent_or_mock = 0
        total_failed = 0

        for days_before in SCHEDULE_DAYS:
            result = send_reminders(db, days_before=days_before, dry_run=False)
            total_candidates += result.total_candidates
            total_sent_or_mock += result.sent_or_mock
            total_failed += result.failed
            print(
                f"[J-{days_before}] candidates={result.total_candidates} "
                f"ok={result.sent_or_mock} failed={result.failed}"
            )

        ended_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        print(
            f"[{ended_at}] Reminder job finished | "
            f"total_candidates={total_candidates} ok={total_sent_or_mock} failed={total_failed}"
        )
        return 0
    except Exception as exc:
        print(f"Reminder job failed: {exc}")
        return 1
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
