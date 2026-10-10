// Controlled API DATA unit harness, not Windows process/kernel qualification.
#include <windows.h>
#include <string>
#include <vector>
#include <iostream>
#include <type_traits>
#include <atomic>
#include <mutex>
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
struct Owner{Handle job;Member root;std::vector<Member> held;};
struct CaptureFixture{bool query=true,open=true,member=true,identity=true;DWORD assigned=0,listed=0;std::vector<ULONG_PTR> pids;int opens=0;} capture;
BOOL FakeJobList(HANDLE,JOBOBJECTINFOCLASS,void* out,DWORD,DWORD*){if(!capture.query)return FALSE;auto* list=static_cast<JOBOBJECT_BASIC_PROCESS_ID_LIST*>(out);list->NumberOfAssignedProcesses=capture.assigned;list->NumberOfProcessIdsInList=capture.listed;for(size_t i=0;i<capture.pids.size()&&i<128;i++)list->ProcessIdList[i]=capture.pids[i];return TRUE;}
HANDLE FakeOpen(DWORD,BOOL,DWORD){capture.opens++;return capture.open?reinterpret_cast<HANDLE>(2):nullptr;}
bool FakeMember(HANDLE,HANDLE){return capture.member;}
bool FakeRead(Member&){return capture.identity;}
#define QueryInformationJobObject FakeJobList
#define OpenProcess FakeOpen
#define MemberOf FakeMember
#define ReadIdentity FakeRead
// ACTUAL_HOST_CAPTURE_CURRENT
template<class F>bool CallCapture(F f,Owner* owner,bool& retry){if constexpr(std::is_invocable_v<F,Owner*,bool&>)return f(owner,retry);else return f(owner);}
struct AsyncOwner{Handle job;Member root;std::vector<Member> held;std::mutex terminationLock;std::atomic<bool> stopping{false};};
struct HostAsyncShutdown{AsyncOwner* owner;const char* error=nullptr;DWORD code=77;std::vector<int> peers;};
using napi_env=void*;
struct AsyncFixture{int elapsed=0,deadline=20,deadlineCalls=0,expireAtCall=0,terminates=0,captures=0,cancels=0,joins=0;bool captureOk=true,retry=false,exitOk=true,dead=true;DWORD active=0;} asyncFixture;
bool FakeDeadline(HostAsyncShutdown*){asyncFixture.deadlineCalls++;return (!asyncFixture.expireAtCall||asyncFixture.deadlineCalls<asyncFixture.expireAtCall)&&asyncFixture.elapsed<asyncFixture.deadline;}
bool FakeCapture(AsyncOwner*,bool& retry){asyncFixture.captures++;retry=asyncFixture.retry;return asyncFixture.captureOk;}
bool FakeCapture(AsyncOwner* p){bool retry=false;return FakeCapture(p,retry);}
BOOL FakeTerminate(HANDLE,DWORD){asyncFixture.terminates++;return TRUE;}
bool FakeActive(AsyncOwner*,DWORD& active){active=asyncFixture.active;return true;}
bool FakeExact(const Member&,bool& dead){dead=dead&&asyncFixture.dead;return asyncFixture.exitOk;}
bool FakeCancel(HostAsyncShutdown*){asyncFixture.cancels++;return true;}
int FakePeers(const std::vector<int>&){asyncFixture.joins++;return 1;}
void FakeSleep(DWORD ms){asyncFixture.elapsed+=static_cast<int>(ms);}
#define HostDeadline FakeDeadline
#define HostCaptureCurrentMembers FakeCapture
#define TerminateJobObject FakeTerminate
#define Active FakeActive
#define HostExactExited FakeExact
#define HostCancelMonitor FakeCancel
#define PeerHostRosterJoined FakePeers
#define Sleep FakeSleep
// ACTUAL_HOST_ASYNC_EXECUTE
#undef HostCaptureCurrentMembers
#undef HostExactExited
int main(){
 int cases=0,failed=0;
 auto check=[&](const char* name,Member member,bool initial,bool want,bool wantDead,int wantImages=-1){bool dead=initial;bool actual=HostExactExited(member,dead);++cases;bool ok=actual==want&&(!want||dead==wantDead)&&(wantImages<0||fixture.imageCalls==wantImages);if(!ok)++failed;std::cout<<name<<":"<<(ok?"PASS":"FAIL")<<"\n";};
 Member member;
 fixture=Fixture{};fixture.image=false;fixture.waits={WAIT_OBJECT_0};check("dead cached identity with unavailable image and exit259",member,true,true,true,0);
 fixture=Fixture{};check("live exact identity stays live",member,true,true,false,1);
 fixture=Fixture{};fixture.image=false;check("image failure with live retained identity remains pending",member,true,true,false);
 fixture=Fixture{};fixture.image=false;fixture.waits={WAIT_TIMEOUT,WAIT_OBJECT_0};check("image failure racing confirmed death",member,true,true,true,1);
 fixture=Fixture{};fixture.image=false;fixture.waits={WAIT_TIMEOUT,WAIT_OBJECT_0};fixture.exitFailAt=2;check("race exit query failure refuses",member,true,false,false);
 fixture=Fixture{};fixture.image=false;fixture.waits={WAIT_TIMEOUT,WAIT_FAILED};check("unknown second wait refuses",member,true,false,false);
 fixture=Fixture{};fixture.image=false;check("pending image failure cannot reset a live aggregate",member,false,true,false);
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
 auto checkCapture=[&](const char* name,Owner owner,bool want,bool wantRetry,size_t wantHeld,int wantOpens=0){bool retry=false;bool actual=CallCapture(&HostCaptureCurrentMembers,&owner,retry);++cases;bool ok=actual==want&&retry==wantRetry&&owner.held.size()==wantHeld&&capture.opens==wantOpens;if(!ok)++failed;std::cout<<name<<":"<<(ok?"PASS":"FAIL")<<"\n";};
 Owner owner;
 capture=CaptureFixture{};checkCapture("complete empty list",owner,true,false,0);
 capture=CaptureFixture{};capture.assigned=5;checkCapture("incomplete list retries without consuming",owner,false,true,0);
 capture=CaptureFixture{};capture.assigned=2;capture.listed=1;capture.pids={33};checkCapture("partial unknown PID list is not consumed",owner,false,true,0);
 capture=CaptureFixture{};capture.assigned=129;checkCapture("assigned bound refuses before retry",owner,false,false,0);
 capture=CaptureFixture{};capture.assigned=capture.listed=129;checkCapture("listed bound refuses",owner,false,false,0);
 capture=CaptureFixture{};capture.query=false;checkCapture("unknown job query refuses",owner,false,false,0);
 capture=CaptureFixture{};capture.assigned=capture.listed=1;capture.pids={22};checkCapture("known root requires no new handle",owner,true,false,0);
 capture=CaptureFixture{};capture.assigned=capture.listed=1;capture.pids={33};Owner known=owner;Member other;other.pid=33;known.held.push_back(other);checkCapture("known held member retains handle",known,true,false,1);
 capture=CaptureFixture{};capture.assigned=capture.listed=1;capture.pids={33};capture.open=false;checkCapture("unknown new process handle refuses",owner,false,false,0,1);
 capture=CaptureFixture{};capture.assigned=capture.listed=1;capture.pids={33};capture.member=false;checkCapture("unknown membership refuses",owner,false,false,0,1);
 capture=CaptureFixture{};capture.assigned=capture.listed=1;capture.pids={33};capture.identity=false;checkCapture("unknown new identity refuses",owner,false,false,0,1);
 capture=CaptureFixture{};capture.assigned=capture.listed=1;capture.pids={33};checkCapture("complete new identity retained",owner,true,false,1,1);
 capture=CaptureFixture{};capture.assigned=capture.listed=1;capture.pids={33};Owner full=owner;full.held.resize(128);checkCapture("held bound refuses new identity",full,false,false,128);
 capture=CaptureFixture{};capture.assigned=capture.listed=1;capture.pids={0};checkCapture("invalid listed PID refuses",owner,false,false,0);
 auto checkAsync=[&](const char* name,const char* wantError,int wantTerms,int wantCancel,int wantJoins){AsyncOwner p;HostAsyncShutdown work{&p};HostAsyncExecute(nullptr,&work);++cases;bool errorMatches=wantError?work.error&&std::string(work.error)==wantError:work.error==nullptr;bool ok=errorMatches&&asyncFixture.terminates==wantTerms&&asyncFixture.cancels==wantCancel&&asyncFixture.joins==wantJoins&&asyncFixture.elapsed<=asyncFixture.deadline&&asyncFixture.deadlineCalls<100;if(!ok)++failed;std::cout<<name<<":"<<(ok?"PASS":"FAIL")<<"\n";};
 asyncFixture=AsyncFixture{};asyncFixture.captureOk=false;asyncFixture.retry=true;checkAsync("persistent incomplete capture expires without termination","HOST_ASYNC_DEADLINE",0,0,0);
 asyncFixture=AsyncFixture{};asyncFixture.dead=false;asyncFixture.active=1;checkAsync("persistent process pending expires without completion","HOST_ASYNC_DEADLINE",1,0,0);
 asyncFixture=AsyncFixture{};asyncFixture.expireAtCall=3;checkAsync("expired deadline under termination lock cannot terminate","HOST_ASYNC_DEADLINE",0,0,0);
 asyncFixture=AsyncFixture{};asyncFixture.captureOk=false;checkAsync("fatal capture is not retried","HOST_HELD_ROSTER_UNKNOWN",0,0,0);
 asyncFixture=AsyncFixture{};checkAsync("confirmed death joins monitor and peers",nullptr,1,1,1);
 asyncFixture=AsyncFixture{};asyncFixture.exitOk=false;checkAsync("unknown exit never joins monitor or peers","HOST_EXIT_UNVERIFIED",1,0,0);
 std::cout<<"DATA_CASES="<<cases<<" FAILED="<<failed<<"\n";return failed?1:0;
}
