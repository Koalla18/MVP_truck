from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


# Ensure all models are imported so SQLAlchemy can resolve ForeignKey targets
# when mappers are configured (e.g., Vehicle.driver_profile_id -> driver_profiles.id).
from app.models import alert  # noqa: F401,E402
from app.models import audit  # noqa: F401,E402
from app.models import camera  # noqa: F401,E402
from app.models import cargo  # noqa: F401,E402
from app.models import company  # noqa: F401,E402
from app.models import driver  # noqa: F401,E402
from app.models import geozone  # noqa: F401,E402
from app.models import incident  # noqa: F401,E402
from app.models import notification  # noqa: F401,E402
from app.models import notification_rule  # noqa: F401,E402
from app.models import permission  # noqa: F401,E402
from app.models import telemetry  # noqa: F401,E402
from app.models import user  # noqa: F401,E402
from app.models import vehicle  # noqa: F401,E402
from app.models import order  # noqa: F401,E402
