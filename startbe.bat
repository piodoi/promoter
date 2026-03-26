cd .\promoter\backend\
if exist ..\..\.venv\Scripts\python.exe (
  ..\..\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --reload --port 8100
) else (
  python -m uvicorn app.main:app --host 127.0.0.1 --reload --port 8100
)
pause