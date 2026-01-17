from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.settings import settings
from app.api.v1.router import api_router
from app.db.session import init_db


def create_app() -> FastAPI:
    app = FastAPI(title=settings.app_name)

    @app.on_event("startup")
    def _startup() -> None:
        init_db()

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(api_router, prefix=settings.api_prefix)

    @app.get("/health")
    def health():
        return {"status": "ok"}
    
    # Root-level metrics for Prometheus compatibility
    @app.get("/metrics")
    def root_metrics():
        from app.api.v1.routes.metrics import get_metrics
        return get_metrics()

    return app


app = create_app()
