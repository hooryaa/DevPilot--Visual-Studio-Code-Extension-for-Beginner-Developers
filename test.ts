// Test file to trigger DevPilot diagnostics
function test() {
  var unusedVar = 42;  // unused variable
  let x = 5;
  if (x = 10) {  // assignment in condition
    console.log("test");
  }
  let y;  // unused
  return x;
}

const obj = test();
