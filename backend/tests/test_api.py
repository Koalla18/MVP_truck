"""Basic tests for RoutoX API."""

from sqlalchemy import desc
from backend.app.db.session import get_db
from backend.app.models.notification_rule import NotificationRule
import pytest
from fastapi.testclient import TestClient
from app.main import app


client = TestClient(app)


class TestHealth:
    """Health check tests."""
    
    def test_health_endpoint(self):
        """Test health endpoint returns 200."""
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json() == {"status": "ok"}


class TestAuth:
    """Authentication tests."""
    
    def test_login_missing_credentials(self):
        """Test login fails without credentials."""
        response = client.post("/api/v1/auth/login", json={})
        assert response.status_code == 422
    
    def test_login_invalid_credentials(self):
        """Test login fails with invalid credentials."""
        response = client.post(
            "/api/v1/auth/login",
            json={"email": "invalid@example.com", "password": "wrong"}
        )
        assert response.status_code == 401
    
    def test_me_without_token(self):
        """Test /me endpoint requires authentication."""
        response = client.get("/api/v1/auth/me")
        assert response.status_code == 401


class TestVehicles:
    """Vehicle API tests."""
    
    def test_list_vehicles_requires_auth(self):
        """Test vehicles endpoint requires authentication."""
        response = client.get("/api/v1/vehicles")
        assert response.status_code == 401


class TestCargo:
    """Cargo plans tests."""
    
    def test_cargo_plans_requires_auth(self):
        """Test cargo plans endpoint requires authentication."""
        response = client.get("/api/v1/cargo/plans")
        assert response.status_code == 401


class TestMaintenance:
    """Maintenance API tests."""
    
    def test_maintenance_forecast_requires_auth(self):
        """Test maintenance forecast requires authentication."""
        response = client.get("/api/v1/maintenance/forecast")
        assert response.status_code == 401


class TestTelemetry:
    """Telemetry tests."""
    
    def test_positions_requires_auth(self):
        """Test positions endpoint requires authentication."""
        response = client.get("/api/v1/telemetry/positions")
        assert response.status_code == 401
    
    def test_ingest_requires_api_key(self):
        """Test telemetry ingest requires API key."""
        response = client.post(
            "/api/v1/telemetry/ingest",
            json={"updates": []}
        )
        assert response.status_code == 401


class TestNotificationRules:
    """Notification rules tests."""
    
    def test_rules_requires_auth(self):
        """Test notification rules requires authentication."""
        response = client.get("/api/v1/notification-rules")
        assert response.status_code == 401


class TestCamera:
    """Camera clips tests."""
    
    def test_clips_requires_auth(self):
        """Test camera clips requires authentication."""
        response = client.get("/api/v1/camera/clips")
        assert response.status_code == 401


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

@router.get("", response_model=list[RuleResponse])
def list_rules(
    is_active: Optional[bool] = Query(None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all notification rules."""
    
    query = db.query(NotificationRule).filter(
        NotificationRule.company_id == user.company_id
    )
    
    if is_active is not None:
        query = query.filter(NotificationRule.is_active == is_active)
    
    rules = query.order_by(desc(NotificationRule.created_at)).all()
    return rules 

