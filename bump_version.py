#!/usr/bin/env python3
"""Version bumping script for vyasa"""
import re
import sys

def bump_version(bump_type='patch'):
    """Bump version in all relevant files"""
    files = ['pyproject.toml', 'vyasa/__init__.py', 'settings.ini']
    
    for filepath in files:
        try:
            with open(filepath, 'r') as f:
                content = f.read()
            
            # Find current version
            match = re.search(r'version.*?(\d+)\.(\d+)\.(\d+)', content)
            if not match:
                print(f"Warning: No version found in {filepath}")
                continue
            
            major, minor, patch = int(match.group(1)), int(match.group(2)), int(match.group(3))
            
            # Calculate new version
            if bump_type == 'major':
                new_ver = f'{major+1}.0.0'
            elif bump_type == 'minor':
                new_ver = f'{major}.{minor+1}.0'
            elif bump_type == 'patch':
                new_ver = f'{major}.{minor}.{patch+1}'
            else:
                print(f"Invalid bump type: {bump_type}")
                sys.exit(1)
            
            # Replace version
            content = re.sub(r'(version.*?)(\d+\.\d+\.\d+)', rf'\g<1>{new_ver}', content)
            
            with open(filepath, 'w') as f:
                f.write(content)
            
            print(f'Updated {filepath} to {new_ver}')
        
        except FileNotFoundError:
            print(f"Warning: File not found: {filepath}")
        except Exception as e:
            print(f"Error updating {filepath}: {e}")
            sys.exit(1)

if __name__ == '__main__':
    bump_type = sys.argv[1] if len(sys.argv) > 1 else 'patch'
    bump_version(bump_type)
