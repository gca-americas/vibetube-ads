"""Python AST validator for bidding policy scripts."""

import ast
import json
import sys


def validate_script(code: str) -> dict:
    try:
        tree = ast.parse(code)
        compute_bid_fn = next(
            (
                node
                for node in tree.body
                if isinstance(node, ast.FunctionDef) and node.name == "compute_bid"
            ),
            None,
        )
        if not compute_bid_fn:
            return {
                "valid": False,
                "error_type": "SignatureError",
                "message": "Script must define 'def compute_bid(context: AuctionContext) -> float:'",
                "line": None,
            }
        args = compute_bid_fn.args
        total_args = len(args.posonlyargs) + len(args.args)
        if total_args < 1:
            return {
                "valid": False,
                "error_type": "SignatureError",
                "message": "Function 'compute_bid' must accept at least one argument: 'context'",
                "line": compute_bid_fn.lineno,
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
