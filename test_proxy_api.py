#!/usr/bin/env python3
"""
Test script for Proxy Chat Server APIs
Run this after starting the VS Code extension with proxy server enabled
"""

import json
import sys

import requests

BASE_URL = "http://localhost:3899"


def print_section(title):
    print(f"\n{'=' * 60}")
    print(f"  {title}")
    print("=" * 60)


def test_health():
    """Test health check endpoint"""
    print("\n🔍 Testing: GET /health")
    try:
        r = requests.get(f"{BASE_URL}/health", timeout=5)
        if r.status_code == 200:
            print(f"✅ Status: {r.status_code}")
            print(f"   Response: {r.json()}")
            return True
        else:
            print(f"❌ Status: {r.status_code}")
            return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False


def test_model_info():
    """Test model info endpoint"""
    print("\n🔍 Testing: GET /api/model/info")
    try:
        r = requests.get(f"{BASE_URL}/api/model/info", timeout=5)
        if r.status_code == 200:
            data = r.json()
            print(f"✅ Status: {r.status_code}")
            print(f"   Model ID: {data['modelId']}")
            print(f"   Model Name: {data['modelName']}")
            print(f"   Mode: {data['mode']}")
            return True
        else:
            print(f"❌ Status: {r.status_code}")
            print(f"   Response: {r.text}")
            return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False


def test_workspace_structure():
    """Test workspace structure endpoint"""
    print("\n🔍 Testing: GET /api/workspace/structure")
    try:
        r = requests.get(f"{BASE_URL}/api/workspace/structure", timeout=10)
        if r.status_code == 200:
            data = r.json()
            print(f"✅ Status: {r.status_code}")
            print(f"   Workspace Folders: {len(data['workspaceFolders'])}")

            for folder in data["workspaceFolders"]:
                print(f"\n   📁 Folder: {folder['name']}")
                print(f"      Path: {folder['path']}")
                print(f"      Files/Dirs: {len(folder['tree'])}")

                # Show first few items
                for i, item in enumerate(folder["tree"][:3]):
                    icon = "📁" if item["type"] == "directory" else "📄"
                    print(f"      {icon} {item['name']}")

                if len(folder["tree"]) > 3:
                    print(f"      ... and {len(folder['tree']) - 3} more items")

            return True
        else:
            print(f"❌ Status: {r.status_code}")
            print(f"   Response: {r.text}")
            return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False


def test_active_files():
    """Test active files endpoint"""
    print("\n🔍 Testing: GET /api/workspace/active-files")
    try:
        r = requests.get(f"{BASE_URL}/api/workspace/active-files", timeout=5)
        if r.status_code == 200:
            data = r.json()
            files = data["files"]
            print(f"✅ Status: {r.status_code}")
            print(f"   Active Files: {len(files)}")

            for i, file in enumerate(files[:5]):
                print(f"   {i + 1}. {file}")

            if len(files) > 5:
                print(f"   ... and {len(files) - 5} more files")

            return True
        else:
            print(f"❌ Status: {r.status_code}")
            print(f"   Response: {r.text}")
            return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False


def test_file_content(file_path="package.json"):
    """Test file content endpoint"""
    print(f"\n🔍 Testing: GET /api/workspace/file?path={file_path}")
    try:
        r = requests.get(
            f"{BASE_URL}/api/workspace/file", params={"path": file_path}, timeout=5
        )
        if r.status_code == 200:
            content = r.text
            print(f"✅ Status: {r.status_code}")
            print(f"   File: {file_path}")
            print(f"   Size: {len(content)} bytes")

            # Try to parse as JSON if it's a JSON file
            if file_path.endswith(".json"):
                try:
                    data = json.loads(content)
                    print(f"   Preview:")
                    preview = json.dumps(data, indent=2)[:200]
                    print(f"   {preview}...")
                except:
                    print(f"   Preview: {content[:200]}...")
            else:
                print(f"   Preview: {content[:200]}...")

            return True
        elif r.status_code == 404:
            print(f"⚠️  Status: {r.status_code}")
            print(f"   File not found: {file_path}")
            return True  # Not an error, just file doesn't exist
        else:
            print(f"❌ Status: {r.status_code}")
            print(f"   Response: {r.text}")
            return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False


def test_accept_edit():
    """Test accept edit endpoint (placeholder)"""
    print("\n🔍 Testing: POST /api/edit/accept")
    try:
        r = requests.post(
            f"{BASE_URL}/api/edit/accept", json={"editId": "test-edit-123"}, timeout=5
        )
        if r.status_code == 200:
            data = r.json()
            print(f"✅ Status: {r.status_code}")
            print(f"   Success: {data['success']}")
            print(f"   Message: {data.get('message', 'N/A')}")
            return True
        else:
            print(f"❌ Status: {r.status_code}")
            print(f"   Response: {r.text}")
            return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False


def test_decline_edit():
    """Test decline edit endpoint (placeholder)"""
    print("\n🔍 Testing: POST /api/edit/decline")
    try:
        r = requests.post(
            f"{BASE_URL}/api/edit/decline", json={"editId": "test-edit-123"}, timeout=5
        )
        if r.status_code == 200:
            data = r.json()
            print(f"✅ Status: {r.status_code}")
            print(f"   Success: {data['success']}")
            print(f"   Message: {data.get('message', 'N/A')}")
            return True
        else:
            print(f"❌ Status: {r.status_code}")
            print(f"   Response: {r.text}")
            return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False


def test_chat_simple():
    """Test a simple chat request"""
    print("\n🔍 Testing: POST /chat")
    print("   (Streaming response - showing first few chunks)")
    try:
        r = requests.post(
            f"{BASE_URL}/chat",
            json={"prompt": "Say hello in one word"},
            stream=True,
            timeout=30,
        )

        print(f"   Status: {r.status_code}")

        if r.status_code == 200:
            chunk_count = 0
            for line in r.iter_lines():
                if line:
                    line_str = line.decode("utf-8")
                    if line_str.startswith("event: "):
                        event = line_str[7:]
                        print(f"   📨 Event: {event}")
                    elif line_str.startswith("data: "):
                        try:
                            data = json.loads(line_str[6:])
                            if data.get("kind") == "markdown":
                                print(f"   💬 Content: {data.get('value', '')[:50]}...")
                            chunk_count += 1
                            if chunk_count >= 5:  # Limit output
                                print(f"   ... (stopping after 5 chunks)")
                                break
                        except:
                            pass

            print(f"✅ Chat request completed")
            return True
        else:
            print(f"❌ Status: {r.status_code}")
            return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False


def main():
    """Run all tests"""
    print_section("Proxy Chat Server API Test Suite")
    print(f"Base URL: {BASE_URL}")

    results = {
        "Health Check": test_health(),
        "Model Info": test_model_info(),
        "Workspace Structure": test_workspace_structure(),
        "Active Files": test_active_files(),
        "File Content": test_file_content("package.json"),
        "Accept Edit": test_accept_edit(),
        "Decline Edit": test_decline_edit(),
        "Chat Request": test_chat_simple(),
    }

    print_section("Test Results Summary")
    passed = sum(1 for v in results.values() if v)
    total = len(results)

    for test_name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"  {status}  {test_name}")

    print(f"\n  {'=' * 40}")
    print(f"  Total: {passed}/{total} tests passed")
    print(f"  {'=' * 40}\n")

    return 0 if passed == total else 1


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print("\n\n⚠️  Tests interrupted by user")
        sys.exit(1)
