// V8's imports a UWP app on the Xbox can't count on, defined here so PapiV8.dll imports none of them
// (scripts/unity-uwp-v8.ps1; from rnaud/puerts-uwp, where it was proven on the console):
//  - dbghelp: V8's in-process stack dumps (base/debug/stack_trace_win.cc), never enabled by Puerts: every call fails.
//  - winmm timeGetTime: V8's low-resolution clock (base/platform/time.cc), from GetTickCount64 instead.
// The wee8 objects call them through import thunks (__imp_X): both the function and its __imp_ pointer are defined.
// Everything else goes through onecoreuap.lib (OneCore: present on every Windows 10+ device, the Xbox included).
#include <stdint.h>
typedef int BOOL;
typedef unsigned long DWORD;
typedef uint64_t DWORD64;
typedef void* HANDLE;
extern "C" uint64_t __stdcall GetTickCount64(void);

#define STUB(ret, name, args, body) \
    extern "C" ret __stdcall name args body \
    extern "C" void* __imp_##name = (void*)&name;

STUB(DWORD, SymSetOptions, (DWORD o), { return o; })
STUB(BOOL, SymInitialize, (HANDLE, const char*, BOOL), { return 0; })
STUB(BOOL, SymGetSearchPathW, (HANDLE, wchar_t* p, DWORD n), { if (p && n) p[0] = 0; return 0; })
STUB(BOOL, SymSetSearchPathW, (HANDLE, const wchar_t*), { return 0; })
STUB(DWORD64, SymGetModuleBase64, (HANDLE, DWORD64), { return 0; })
STUB(void*, SymFunctionTableAccess64, (HANDLE, DWORD64), { return 0; })
STUB(BOOL, StackWalk64, (DWORD, HANDLE, HANDLE, void*, void*, void*, void*, void*, void*), { return 0; })
STUB(BOOL, SymFromAddr, (HANDLE, DWORD64, DWORD64*, void*), { return 0; })
STUB(BOOL, SymGetLineFromAddr64, (HANDLE, DWORD64, DWORD*, void*), { return 0; })
STUB(DWORD, timeGetTime, (void), { return (DWORD)GetTickCount64(); })
STUB(unsigned, timeBeginPeriod, (unsigned), { return 0; })
STUB(unsigned, timeEndPeriod, (unsigned), { return 0; })
