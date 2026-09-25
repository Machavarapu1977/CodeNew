import asyncio
from services.piston_service import execute_code

tests = [
    # The original failing case from the screenshot
    ("sum(a,b) - exact failing case",  "a,b=map(int,input().split())\nprint(sum(a,b))",             "2 3",       "5"),
    # Plain scripts
    ("simple addition",                "a,b=map(int,input().split())\nprint(a+b)",                  "10 20",     "30"),
    ("n=3 input read and print",       "n=int(input())\nprint(n*2)",                                 "3",         "6"),
    ("n = 3 style stdin (with =)",     "n=int(input())\nprint(n)",                                   "n = 3",     "3"),
    # Built-in edge cases
    ("sum(a,b,c) 3 scalars",           "a,b,c=map(int,input().split())\nprint(sum(a,b,c))",          "1 2 3",     "6"),
    ("sum([list]) normal",             "nums=list(map(int,input().split()))\nprint(sum(nums))",       "1 2 3 4",   "10"),
    ("sum([list],start) normal",       "nums=list(map(int,input().split()))\nprint(sum(nums,10))",    "1 2 3",     "16"),
    ("min(a,b) scalars",               "a,b=map(int,input().split())\nprint(min(a,b))",              "7 3",       "3"),
    ("min([list]) normal",             "nums=list(map(int,input().split()))\nprint(min(nums))",       "7 3 5",     "3"),
    ("max(a,b) scalars",               "a,b=map(int,input().split())\nprint(max(a,b))",              "7 3",       "7"),
    ("max(a,b,c) three scalars",       "a,b,c=map(int,input().split())\nprint(max(a,b,c))",          "1 5 3",     "5"),
    ("max([list]) normal",             "nums=list(map(int,input().split()))\nprint(max(nums))",       "1 5 3",     "5"),
    ("abs(n) negative",                "n=int(input())\nprint(abs(n))",                               "-5",        "5"),
    ("abs(n) positive",                "n=int(input())\nprint(abs(n))",                               "5",         "5"),
    ("len([list]) normal",             "nums=list(map(int,input().split()))\nprint(len(nums))",       "1 2 3 4 5", "5"),
    ("pow(a,b) normal",                "a,b=map(int,input().split())\nprint(pow(a,b))",              "2 8",       "256"),
    ("sorted list",                    "nums=list(map(int,input().split()))\nprint(sorted(nums))",    "3 1 2",     "[1, 2, 3]"),
]

async def run_all():
    all_ok = True
    for name, code, stdin, expected in tests:
        res = await execute_code("python3", code, stdin)
        actual = (res.get("output") or "").strip()
        err = res.get("error")
        ok = actual == expected and not err
        status = "OK" if ok else "FAIL"
        if not ok:
            all_ok = False
            print(f"[{status}] {name}: expected={repr(expected)} got={repr(actual)} err={repr(err[:120] if err else err)}")
        else:
            print(f"[{status}] {name}")
    print()
    print("All tests passed!" if all_ok else "SOME TESTS FAILED")

asyncio.run(run_all())
