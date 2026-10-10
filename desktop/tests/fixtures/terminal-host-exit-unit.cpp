// Controlled API DATA unit harness, not Windows process/kernel qualification.
#include <windows.h>
#include <string>
#include <vector>
#include <iostream>
struct Handle{HANDLE h=reinterpret_cast<HANDLE>(1);};
struct Member{Handle process;DWORD pid=22;ULONGLONG created=1000;std::wstring image=L"known.exe";};
ULONGLONG Ticks(FILETIME t){return (static_cast<ULONGLONG>(t.dwHighDateTime)<<32)|t.dwLowDateTime;}
struct Fixture{
 DWORD pid=22;ULONGLONG birth=1000;bool times=true,image=true;int exitFailAt=0,exitCalls=0,imageCalls=0,waitCalls=0;
 std::wstring path=L"known.exe";std::vector<DWORD> waits{WAIT_TIMEOUT};
} fixture;
DWORD FakePid(HANDLE){return fixture.pid;}
BOOL FakeTimes(HANDLE,FILETIME* c,FILETIME*,FILETIME*,FILETIME*){c->dwHighDateTime=static_cast<DWORD>(fixture.birth>>32);c->dwLowDateTime=static_cast<DWORD>(fixture.birth);return fixture.times;}
DWORD FakeWait(HANDLE,DWORD){const size_t index=fixture.waitCalls++;return fixture.waits[index<fixture.waits.size()?index:fixture.waits.size()-1];}
BOOL FakeExit(HANDLE,DWORD* code){*code=STILL_ACTIVE;return ++fixture.exitCalls!=fixture.exitFailAt;}
BOOL FakeImage(HANDLE,DWORD,wchar_t* out,DWORD* size){++fixture.imageCalls;if(!fixture.image)return FALSE;*size=static_cast<DWORD>(fixture.path.size());fixture.path.copy(out,*size);return TRUE;}
#define GetProcessId FakePid
#define GetProcessTimes FakeTimes
#define WaitForSingleObject FakeWait
#define GetExitCodeProcess FakeExit
#define QueryFullProcessImageNameW FakeImage
// ACTUAL_HOST_EXACT_EXITED
int main(){
 int cases=0,failed=0;
 auto check=[&](const char* name,Member member,bool initial,bool want,bool wantDead,int wantImages=-1){bool dead=initial;bool actual=HostExactExited(member,dead);++cases;bool ok=actual==want&&(!want||dead==wantDead)&&(wantImages<0||fixture.imageCalls==wantImages);if(!ok)++failed;std::cout<<name<<":"<<(ok?"PASS":"FAIL")<<"\n";};
 Member member;
 fixture=Fixture{};fixture.image=false;fixture.waits={WAIT_OBJECT_0};check("dead cached identity with unavailable image and exit259",member,true,true,true,0);
 fixture=Fixture{};check("live exact identity stays live",member,true,true,false,1);
 fixture=Fixture{};fixture.image=false;check("still-live image failure refuses",member,true,false,false);
 fixture=Fixture{};fixture.image=false;fixture.waits={WAIT_TIMEOUT,WAIT_OBJECT_0};check("image failure racing confirmed death",member,true,true,true,1);
 fixture=Fixture{};fixture.image=false;fixture.waits={WAIT_TIMEOUT,WAIT_OBJECT_0};fixture.exitFailAt=2;check("race exit query failure refuses",member,true,false,false);
 fixture=Fixture{};fixture.path=L"different.exe";fixture.waits={WAIT_TIMEOUT,WAIT_OBJECT_0};check("image mismatch never waived by later death",member,true,false,false);
 fixture=Fixture{};fixture.pid=23;check("PID mismatch refuses",member,true,false,false);
 fixture=Fixture{};fixture.pid=0;check("PID query failure refuses",member,true,false,false);
 fixture=Fixture{};fixture.times=false;check("times unknown refuses",member,true,false,false);
 fixture=Fixture{};fixture.birth=1001;check("birth mismatch refuses",member,true,false,false);
 fixture=Fixture{};fixture.waits={WAIT_FAILED};check("wait unknown refuses",member,true,false,false);
 fixture=Fixture{};fixture.exitFailAt=1;check("exit query unknown refuses",member,true,false,false);
 fixture=Fixture{};Member missing=member;missing.process.h=nullptr;check("missing retained handle refuses",missing,true,false,false);
 fixture=Fixture{};fixture.image=false;fixture.waits={WAIT_OBJECT_0};check("dead member cannot reset live aggregate",member,false,true,false,0);
 fixture=Fixture{};Member empty=member;empty.image.clear();fixture.waits={WAIT_OBJECT_0};check("missing captured image refuses",empty,true,false,false);
 std::cout<<"DATA_CASES="<<cases<<" FAILED="<<failed<<"\n";return failed?1:0;
}
