@echo off
REM Start backend on fixed port 8000
uvicorn app:app --reload --port 8000