from __future__ import annotations

import uvicorn


def main() -> None:
    """Run the FastAPI development server."""
    uvicorn.run("src.server.app:app", host="0.0.0.0", port=8000, reload=False)


if __name__ == "__main__":
    main()
