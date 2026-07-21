const fs = require('fs');
const path = require('path');

const INDEX_PATH = path.resolve(__dirname, '../src/app/index.tsx');
const ONBOARDING_PATH = path.resolve(__dirname, '../src/app/onboarding.tsx');

function runStressTest() {
  console.log("=== Challenger M3 Stress-Test / Style Validator ===");

  let errors = 0;
  let warnings = 0;

  // 1. Load files
  const indexContent = fs.readFileSync(INDEX_PATH, 'utf8');
  const onboardingContent = fs.readFileSync(ONBOARDING_PATH, 'utf8');

  // 2. Validate Onboarding Backdrop Filter
  console.log("\nTesting Onboarding Screen Styles...");

  // Find bottomContainer definition (using line-beginning bracket match)
  const bottomContainerMatch = onboardingContent.match(/bottomContainer:\s*\{([\s\S]*?)\n\s*\},/);
  if (!bottomContainerMatch) {
    console.error("FAIL: Could not locate bottomContainer styles in onboarding.tsx");
    errors++;
  } else {
    const stylesText = bottomContainerMatch[1];

    // Check for backdropFilter
    const hasBackdropFilter = stylesText.includes("backdropFilter");
    const hasWebkitBackdropFilter = stylesText.includes("WebkitBackdropFilter");

    if (hasBackdropFilter || hasWebkitBackdropFilter) {
      console.log("  - Found backdropFilter definition.");

      // Ensure backdropFilter is wrapped in Platform.select({ web: ... })
      const isPlatformSelectWeb = /Platform\.select\(\{\s*web:\s*\{[\s\S]*?backdropFilter/.test(stylesText);
      if (isPlatformSelectWeb) {
        console.log("  - SUCCESS: backdropFilter is safely wrapped in Platform.select({ web }) to prevent native crashes.");
      } else {
        console.error("  - FAIL: backdropFilter is NOT safely wrapped in Platform.select({ web }). This will CRASH native iOS/Android!");
        errors++;
      }
    } else {
      console.warn("  - WARNING: No backdropFilter found in bottomContainer.");
      warnings++;
    }
  }

  // 3. Validate FAB Button Styles in index.tsx
  console.log("\nTesting FAB Button Styles...");

  const floatingActionMatch = indexContent.match(/floatingAction:\s*\{([\s\S]*?)\n\s*\},/);
  const unpressedMatch = indexContent.match(/floatingActionUnpressed:\s*\{([\s\S]*?)\n\s*\},/);
  const pressedMatch = indexContent.match(/floatingActionPressed:\s*\{([\s\S]*?)\n\s*\},/);

  if (!floatingActionMatch || !unpressedMatch || !pressedMatch) {
    console.error("FAIL: Could not find floatingAction, floatingActionUnpressed, or floatingActionPressed style blocks.");
    errors++;
  } else {
    const baseText = floatingActionMatch[1];
    const unpressedText = unpressedMatch[1];
    const pressedText = pressedMatch[1];

    // Check position absolute
    if (baseText.includes("position: 'absolute'")) {
      console.log("  - SUCCESS: FAB is absolutely positioned.");
    } else {
      console.error("  - FAIL: FAB is NOT absolutely positioned. This may cause layout shifts/reflows of sibling elements.");
      errors++;
    }

    // Check fixed height and width (ensures overall layout boundary is constant)
    const hasWidth = /width:\s*\d+/.test(baseText);
    const hasHeight = /height:\s*\d+/.test(baseText);
    if (hasWidth && hasHeight) {
      console.log("  - SUCCESS: FAB has fixed dimensions, reducing layout reflow risk.");
    } else {
      console.error("  - FAIL: FAB must have fixed width and height.");
      errors++;
    }

    // Check translateY shifts
    const unpressedY = unpressedText.match(/translateY:\s*(\d+)/);
    const pressedY = pressedText.match(/translateY:\s*(\d+)/);
    if (unpressedY && pressedY) {
      const uY = parseInt(unpressedY[1], 10);
      const pY = parseInt(pressedY[1], 10);
      console.log(`  - Found translateY: unpressed=${uY}, pressed=${pY}`);
      if (pY > uY) {
        console.log("  - SUCCESS: Pressed translateY shifts button downward.");
      } else {
        console.warn("  - WARNING: Pressed translateY is not greater than unpressed translateY.");
        warnings++;
      }
    } else {
      console.error("  - FAIL: Could not identify translateY inside transforms.");
      errors++;
    }

    // Check borderBottomWidth shifts
    const unpressedBorder = unpressedText.match(/borderBottomWidth:\s*([\d.]+)/);
    const pressedBorder = pressedText.match(/borderBottomWidth:\s*([\d.]+)/);
    if (unpressedBorder && pressedBorder) {
      const uB = parseFloat(unpressedBorder[1]);
      const pB = parseFloat(pressedBorder[1]);
      console.log(`  - Found borderBottomWidth: unpressed=${uB}, pressed=${pB}`);
      if (uB > pB) {
        console.log("  - SUCCESS: pressed border bottom is thinner, simulating depress effect.");
      } else {
        console.error("  - FAIL: pressed border bottom must be thinner than unpressed.");
        errors++;
      }
    } else {
      console.error("  - FAIL: Could not find borderBottomWidth properties.");
      errors++;
    }

    // Check shadow changes
    const unpressedShadowHeight = baseText.match(/shadowOffset:\s*\{\s*width:\s*\d+,\s*height:\s*(\d+)\s*\}/);
    const pressedShadowHeight = pressedText.match(/shadowOffset:\s*\{\s*width:\s*\d+,\s*height:\s*(\d+)\s*\}/);
    if (unpressedShadowHeight && pressedShadowHeight) {
      const uSH = parseInt(unpressedShadowHeight[1], 10);
      const pSH = parseInt(pressedShadowHeight[1], 10);
      console.log(`  - Found shadowOffset heights: unpressed=${uSH}, pressed=${pSH}`);
      if (uSH > pSH) {
        console.log("  - SUCCESS: pressed shadow offset height is smaller, simulating proximity.");
      } else {
        console.warn("  - WARNING: pressed shadow height is not smaller than unpressed.");
        warnings++;
      }
    } else {
      console.warn("  - WARNING: missing shadowOffset measurements to verify depth differences.");
      warnings++;
    }
  }

  console.log("\n=== Stress Test Summary ===");
  console.log(`Errors: ${errors}, Warnings: ${warnings}`);
  if (errors === 0) {
    console.log("STATUS: SUCCESS. All style constraints are safe and pass review!");
    process.exit(0);
  } else {
    console.log("STATUS: FAIL. Styling errors detected.");
    process.exit(1);
  }
}

runStressTest();
