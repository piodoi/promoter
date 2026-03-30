cd .\backend\
if exist ..\.venv\Scripts\python.exe (
  ..\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --reload --port 8100
) else (
  echo Missing repo-local Python environment at .venv\Scripts\python.exe
  echo Create it from the repository root with:
  echo   py -3.9 -m venv .venv
  echo   .venv\Scripts\python.exe -m pip install -r backend\requirements.txt
  exit /b 1
)
pause