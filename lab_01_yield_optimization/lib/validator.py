"""Python AST validator for bidding policy scripts."""

import ast
import json
import sys


def validate_script(code: str) -> dict:
    try:
        tree = ast.parse(code)
        has_compute_bid = any(
            isinstance(node, ast.FunctionDef) and node.name == "compute_bid"
            for node in tree.body
        )
        if not has_compute_bid:
            return {
                "valid": False,
                "error_type": "SignatureError",
                "message": "Script must define 'def compute_bid(context: AuctionContext) -> float:'",
                "line": None,
            }
        return {
            "valid": True,
            "message": "Python syntax & compute_bid signature valid",
        }
    except SyntaxError as e:
        return {
            "valid": False,
            "error_type": "SyntaxError",
            "message": f"SyntaxError: {e.msg}",
            "line": e.lineno,
            "offset": e.offset,
            "text": e.text.strip() if e.text else "",
        }
    except Exception as e:
        return {
            "valid": False,
            "error_type": type(e).__name__,
            "message": str(e),
            "line": None,
        }


if __name__ == "__main__":
    code_input = sys.stdin.read()
    res = validate_script(code_input)
    print(json.dumps(res))
