#!/usr/bin/env python
"""Test script to build the demo static site"""

import sys
from pathlib import Path

# Add the current directory to path so we can import vyasa
sys.path.insert(0, str(Path(__file__).parent))

from vyasa.build import build_static_site

if __name__ == '__main__':
    try:
        output_dir = build_static_site(
            input_dir='demo',
            output_dir='dist'
        )
        print(f"\n✨ Build complete! Site generated in: {output_dir}")
        print(f"\nTo test:")
        print(f"  cd {output_dir}")
        print(f"  python -m http.server 8000")
    except Exception as e:
        print(f"❌ Build failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
