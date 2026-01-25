#!/usr/bin/env python3
"""
Local development runner for RoutoX backend.
Runs without Docker, uses SQLite by default.

Usage:
    python run_local.py [--seed] [--port PORT]
"""

import argparse
import os
import sys

# Ensure we're in the backend directory
os.chdir(os.path.dirname(os.path.abspath(__file__)))

# Set environment for local dev
os.environ.setdefault("DATABASE_URL", "sqlite:///./routa_dev.db")
os.environ.setdefault("DEBUG", "true")
os.environ.setdefault("CORS_ORIGINS", "http://localhost:3000,http://localhost:8080,http://127.0.0.1:3000")


def seed_database():
    """Seed demo data."""
    print("\n🌱 Seeding demo data...")
    from app.scripts.seed_demo_data import seed_demo
    seed_demo()
    print("✅ Demo data seeded!\n")


def run_server(port: int = 8000):
    """Run uvicorn server."""
    import uvicorn
    print(f"\n🚀 Starting RoutoX API on http://localhost:{port}")
    print("📚 API docs: http://localhost:{}/docs".format(port))
    print("❤️  Health check: http://localhost:{}/health\n".format(port))
    
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=port,
        reload=True,
        log_level="info"
    )


def main():
    parser = argparse.ArgumentParser(description="RoutoX Local Development Runner")
    parser.add_argument("--seed", action="store_true", help="Seed demo data before starting")
    parser.add_argument("--seed-only", action="store_true", help="Only seed data, don't start server")
    parser.add_argument("--port", type=int, default=8000, help="Server port (default: 8000)")
    args = parser.parse_args()
    
    print("=" * 50)
    print("🚛 RoutoX Local Development Server")
    print("=" * 50)
    
    # Initialize database
    print("\n📦 Initializing database...")
    from app.db.session import init_db
    init_db()
    print("✅ Database ready!")
    
    if args.seed or args.seed_only:
        seed_database()
    
    if not args.seed_only:
        run_server(args.port)


if __name__ == "__main__":
    main()
