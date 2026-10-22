using System.Collections.Generic;
using NUnit.Framework;
using Hiraeth.Bridge;

namespace Hiraeth.Tests
{
    public class BridgePlayerUpdatesTests
    {
        [TestCase("busy")]
        [TestCase("current")]
        [TestCase("error")]
        [TestCase("offline")]
        public void FreshRecheckThatIsNotReadyNeverFlushesOrExits(string state)
        {
            var result = BridgePlayerUpdates.Complete(new() { ["state"] = state }, 0, true,
                () => { Assert.Fail("not verified ready"); return true; }, () => Assert.Fail("must stay open"));
            Assert.AreEqual(state, result["state"]);
        }
        [Test]
        public void ReadyMustFlushSuccessfullyBeforeExit()
        {
            var calls = new List<string>();
            BridgePlayerUpdates.Complete(new() { ["state"] = "ready" }, 0, true,
                () => { calls.Add("flush"); return true; }, () => calls.Add("exit"));
            CollectionAssert.AreEqual(new[] { "flush", "exit" }, calls);
            var fail = BridgePlayerUpdates.Complete(new() { ["state"] = "ready" }, 0, true,
                () => false, () => Assert.Fail("failed save"));
            Assert.AreEqual("error", fail["state"]);
        }
        [Test]
        public void FailedProcessCannotAuthorizeReadyAndPreservesConcreteFailure()
        {
            var fail = BridgePlayerUpdates.Complete(new() { ["state"] = "ready" }, 1, true,
                () => { Assert.Fail("failed helper"); return true; }, () => Assert.Fail("failed helper"));
            Assert.AreEqual("error", fail["state"]);
            var offline = BridgePlayerUpdates.Complete(new() { ["state"] = "offline", ["detail"] = "DNS unavailable" }, 1, true,
                () => false, () => Assert.Fail("offline"));
            Assert.AreEqual("DNS unavailable", offline["detail"]);
        }
        [Test]
        public void DownloadReadyAloneDoesNotExitWithoutExplicitRestart()
        {
            BridgePlayerUpdates.Complete(new() { ["state"] = "ready" }, 0, false,
                () => { Assert.Fail("not restarting"); return false; }, () => Assert.Fail("not restarting"));
        }
    }
}
