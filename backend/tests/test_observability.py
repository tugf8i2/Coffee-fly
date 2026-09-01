import unittest
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

from app.main import app
from app.core.observability import OperationalMetrics, SlidingWindowRateLimiter
from app.api.monitoring_api import classify_gps_state


class RateLimiterTests(unittest.TestCase):
    def test_blocks_after_limit_and_reports_retry(self):
        limiter = SlidingWindowRateLimiter(limit=2, window_seconds=60)
        self.assertEqual(limiter.check("device", now=100), (True, 0))
        self.assertEqual(limiter.check("device", now=110), (True, 0))
        allowed, retry_after = limiter.check("device", now=120)
        self.assertFalse(allowed)
        self.assertEqual(retry_after, 41)

    def test_window_recovers_and_keys_are_isolated(self):
        limiter = SlidingWindowRateLimiter(limit=1, window_seconds=10)
        self.assertTrue(limiter.check("first", now=0)[0])
        self.assertFalse(limiter.check("first", now=9)[0])
        self.assertTrue(limiter.check("second", now=9)[0])
        self.assertTrue(limiter.check("first", now=10)[0])

    def test_prunes_inactive_ip_keys(self):
        limiter = SlidingWindowRateLimiter(limit=2, window_seconds=10)
        limiter.check("old-a", now=0)
        limiter.check("old-b", now=0)
        self.assertEqual(limiter.tracked_keys, 2)
        limiter.check("current", now=11)
        self.assertEqual(limiter.tracked_keys, 1)


class OperationalMetricsTests(unittest.TestCase):
    def test_thread_safe_counter_snapshot(self):
        metrics = OperationalMetrics()
        metrics.increment("gps_points_saved", 2)
        metrics.increment("gps_points_saved")
        snapshot = metrics.snapshot()
        self.assertEqual(snapshot["contadores"]["gps_points_saved"], 3)
        self.assertIsNotNone(snapshot["desde"].tzinfo)


class GpsMonitoringStateTests(unittest.TestCase):
    def test_reports_missing_location(self):
        now = datetime(2026, 8, 29, 18, 0, tzinfo=timezone.utc)
        self.assertEqual(classify_gps_state(None, now), ("sin_ubicacion", None))

    def test_reports_fresh_location_at_the_two_minute_boundary(self):
        now = datetime(2026, 8, 29, 18, 0, tzinfo=timezone.utc)
        self.assertEqual(
            classify_gps_state(now - timedelta(seconds=120), now),
            ("actualizado", 120),
        )

    def test_reports_stale_location_and_accepts_legacy_naive_timestamps(self):
        now = datetime(2026, 8, 29, 18, 0, tzinfo=timezone.utc)
        legacy = (now - timedelta(seconds=121)).replace(tzinfo=None)
        self.assertEqual(classify_gps_state(legacy, now), ("desactualizado", 121))


class RequestProtectionTests(unittest.TestCase):
    def test_large_login_body_is_rejected_before_authentication(self):
        client = TestClient(app)
        response = client.post(
            "/login",
            content=b"x" * (6 * 1024 * 1024 + 1),
            headers={"Content-Type": "application/json", "X-Request-ID": "large-login-test"},
        )
        self.assertEqual(response.status_code, 413)
        self.assertEqual(response.json()["error"]["code"], "PAYLOAD_TOO_LARGE")
        self.assertEqual(response.headers["X-Request-ID"], "large-login-test")


if __name__ == "__main__":
    unittest.main()
