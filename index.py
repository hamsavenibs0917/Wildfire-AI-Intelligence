import sys
sys.dont_write_bytecode = True

from app import app

# Vercel entrypoint delegating to root app.py
if __name__ == '__main__':
    app.run()
