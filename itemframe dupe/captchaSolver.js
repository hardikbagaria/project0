/*
captchaSolver.js
-------------
This module exports an async function, solveCaptcha(bot, showDebug),
that:
  • Builds a grid from all block display entities (with blockId === 2060)
    by computing each block’s center (effective corner + half the dimensions
    from metadata[12], defaulting to a unit cube).
  • Uses a BFS algorithm (only cardinal moves allowed) to compute a valid path
    from the start (-999.5, -1019.5) to the goal (-999.5, -1005.5), ensuring no
    diagonal moves or backtracking.
  • Draws the solution path as one continuous blue line (each point raised by 2 in y)
    and wireframe boxes for the blocks, if debug is enabled.
  • Moves the bot along that path one grid cell (block) at a time (first aligning
    along x, then along z) with a 1‑second pause between grid cells. After the final
    cell is reached, the bot makes an extra move to (-999.5, -1004.5).
  • Continuously updates a vertical magenta line to indicate the bot’s current position.
  • Sends chat messages and logs progress (all of which are suppressed if showDebug is false).
  • The bot holds the sneak key throughout movement.
*/

let debug = true; // module-wide flag

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Compute effective corner: entity.position + offset (from metadata[11])
function getEffectivePosition(entity) {
  const pos = entity.position;
  const offset = (entity.metadata && entity.metadata[11]) || { x: 0, y: 0, z: 0 };
  return { x: pos.x + offset.x, y: pos.y + offset.y, z: pos.z + offset.z };
}

// Compute block center = effective corner + half the dimensions (metadata[12] or default to 1×1×1)
function getBlockCenter(entity) {
  const effective = getEffectivePosition(entity);
  const dim = (entity.metadata && entity.metadata[12]) || { x: 1, y: 1, z: 1 };
  return { x: effective.x + dim.x / 2, y: effective.y + dim.y / 2, z: effective.z + dim.z / 2 };
}

// Draw a wireframe box (for visualization) if debug is true.
function drawWireframeBox(corner, dim, id, color, bot) {
  if (!debug) return;
  const x1 = corner.x, y1 = corner.y, z1 = corner.z;
  const x2 = corner.x + dim.x, y2 = corner.y + dim.y, z2 = corner.z + dim.z;
  const minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
  const minY = Math.min(y1, y2), maxY = Math.max(y1, y2);
  const minZ = Math.min(z1, z2), maxZ = Math.max(z1, z2);
  
  const corners = [
    { x: minX, y: minY, z: minZ },
    { x: maxX, y: minY, z: minZ },
    { x: maxX, y: maxY, z: minZ },
    { x: minX, y: maxY, z: minZ },
    { x: minX, y: minY, z: maxZ },
    { x: maxX, y: minY, z: maxZ },
    { x: maxX, y: maxY, z: maxZ },
    { x: minX, y: maxY, z: maxZ }
  ];
  
  const edges = [
    [0,1],[1,2],[2,3],[3,0],
    [4,5],[5,6],[6,7],[7,4],
    [0,4],[1,5],[2,6],[3,7]
  ];
  
  edges.forEach((edge, i) => {
    const line = [corners[edge[0]], corners[edge[1]]];
    bot.viewer.drawLine(id + '_edge' + i, line, color);
  });
}

// Return a grid key from a point by rounding x and z to one decimal.
function gridKey(point) {
  return `${point.x.toFixed(1)},${point.z.toFixed(1)}`;
}

// Build a grid mapping from grid key to block center (for block display entities with blockId === 2060)
function buildGrid(bot) {
  const grid = {};
  for (const entityId in bot.entities) {
    const entity = bot.entities[entityId];
    if (entity.name === 'block_display') {
      const blockId = (entity.metadata && entity.metadata[23]) || null;
      if (blockId === 2060) {
        const center = getBlockCenter(entity);
        const key = gridKey(center);
        grid[key] = center;
        // Draw the wireframe box for visualization if debug is on.
        const dimensions = (entity.metadata && entity.metadata[12]) || { x: 1, y: 1, z: 1 };
        drawWireframeBox(getEffectivePosition(entity), dimensions, `box_${entity.id}`, 0x808080, bot);
      }
    }
  }
  return grid;
}

// BFS algorithm that allows only cardinal moves (dx or dz = ±1).
function findPathBFS(startKey, goalKey, grid) {
  const queue = [];
  const cameFrom = {};
  queue.push(startKey);
  cameFrom[startKey] = null;
  
  const directions = [
    { dx: 1, dz: 0 },
    { dx: -1, dz: 0 },
    { dx: 0, dz: 1 },
    { dx: 0, dz: -1 }
  ];
  
  while (queue.length > 0) {
    const current = queue.shift();
    if (current === goalKey) break;
    
    const [cxStr, czStr] = current.split(',');
    const cx = parseFloat(cxStr), cz = parseFloat(czStr);
    for (const d of directions) {
      const nx = cx + d.dx;
      const nz = cz + d.dz;
      const neighborKey = `${nx.toFixed(1)},${nz.toFixed(1)}`;
      if (grid[neighborKey] !== undefined && cameFrom[neighborKey] === undefined) {
        queue.push(neighborKey);
        cameFrom[neighborKey] = current;
      }
    }
  }
  if (cameFrom[goalKey] === undefined) return null;
  
  const path = [];
  let current = goalKey;
  while (current !== null) {
    path.push(current);
    current = cameFrom[current];
  }
  path.reverse();
  return path;
}

// Draw the solution path as one continuous blue line connecting the block centers, raised 2 in y.
function drawSolutionPath(pathKeys, grid, bot) {
  if (!debug) return;
  const points = pathKeys.map(key => {
    const pt = grid[key];
    return { x: pt.x, y: pt.y + 2, z: pt.z };
  });
  bot.viewer.drawLine("solutionLine", points, 0x0000ff);
}

// Move the bot along the BFS path one grid cell at a time.
// For each grid cell, the bot first aligns along x and then along z (no diagonal movement).
// After following the BFS path, an extra move is made from (-999.5, -1005.5) to (-999.5, -1004.5).
// The bot holds sneak ("shift") the entire time.
async function followBFSPath(pathKeys, grid, bot) {
  // Hold sneak continuously.
  bot.setControlState('sneak', true);
  const tol = 0.2;
  
  for (let i = 0; i < pathKeys.length; i++) {
    const target = grid[pathKeys[i]];
    if (debug) {
      const msg = `Heading to grid cell ${i + 1} at (${target.x.toFixed(2)}, ${target.z.toFixed(2)})`;
      console.log(msg);
    }
    // Align along X axis.
    while (Math.abs(bot.entity.position.x - target.x) > tol) {
      if (debug)
        console.log(`Aligning X: Bot x=${bot.entity.position.x.toFixed(2)}; Target x=${target.x.toFixed(2)}`);
      bot.setControlState('left', false);
      bot.setControlState('right', false);
      const deltaX = target.x - bot.entity.position.x;
      if (deltaX > tol) {
        bot.setControlState('left', true);
      } else if (deltaX < -tol) {
        bot.setControlState('right', true);
      }
      await sleep(100);
    }
    bot.setControlState('left', false);
    bot.setControlState('right', false);
    
    // Align along Z axis.
    while (Math.abs(bot.entity.position.z - target.z) > tol) {
      if (debug)
        console.log(`Aligning Z: Bot z=${bot.entity.position.z.toFixed(2)}; Target z=${target.z.toFixed(2)}`);
      bot.setControlState('forward', false);
      bot.setControlState('back', false);
      const deltaZ = target.z - bot.entity.position.z;
      if (deltaZ > tol) {
        bot.setControlState('forward', true);
      } else if (deltaZ < -tol) {
        bot.setControlState('back', true);
      }
      await sleep(100);
    }
    bot.setControlState('forward', false);
    bot.setControlState('back', false);
    
    if (debug) {
      const reachedMsg = `Reached grid cell ${i + 1} at (${bot.entity.position.x.toFixed(2)}, ${bot.entity.position.z.toFixed(2)})`;
      console.log(reachedMsg);
    }
    await sleep(100);
  }
  
  // Extra step: move one more grid cell forward to (-999.5, -1004.5).
  const finalTarget = { x: -999.5, z: -1004.5 };
  if (debug) {
    const extraMsg = `Final move: Heading to extra cell at (${finalTarget.x.toFixed(2)}, ${finalTarget.z.toFixed(2)})`;
    console.log(extraMsg);
  }
  while (Math.abs(bot.entity.position.x - finalTarget.x) > tol) {
    bot.setControlState('left', false);
    bot.setControlState('right', false);
    const deltaX = finalTarget.x - bot.entity.position.x;
    if (deltaX > tol) {
      bot.setControlState('left', true);
    } else if (deltaX < -tol) {
      bot.setControlState('right', true);
    }
    await sleep(100);
  }
  bot.setControlState('left', false);
  bot.setControlState('right', false);
  
  while (Math.abs(bot.entity.position.z - finalTarget.z) > tol) {
    bot.setControlState('forward', false);
    bot.setControlState('back', false);
    const deltaZ = finalTarget.z - bot.entity.position.z;
    if (deltaZ > tol) {
      bot.setControlState('forward', true);
    } else if (deltaZ < -tol) {
      bot.setControlState('back', true);
    }
    await sleep(100);
  }
  bot.setControlState('forward', false);
  bot.setControlState('back', false);
  
  if (debug) {
    const finalMsg = `Final target reached at (${bot.entity.position.x.toFixed(2)}, ${bot.entity.position.z.toFixed(2)}).`;
    console.log(finalMsg);
  }
}

// Continuously update a vertical magenta line (player marker) at the bot’s current position.
function updatePlayerMarker(bot) {
  if (!debug || !bot.entity) return;
  const pos = bot.entity.position;
  const linePoints = [
    { x: pos.x, y: pos.y, z: pos.z },
    { x: pos.x, y: pos.y + 2, z: pos.z }
  ];
  bot.viewer.drawLine("playerLine", linePoints, 0xff00ff);
}

// Export the main function that solves the captcha.
// If showDebug is false, all drawing and logging are disabled.
export async function solveCaptcha(bot, showDebug = true) {
  debug = showDebug; // set the module-wide debug flag
  
  const grid = buildGrid(bot);
  
  const startPoint = { x: -999.5, y: 0, z: -1019.5 };
  const goalPoint  = { x: -999.5, y: 0, z: -1005.5 };
  const startKey = gridKey(startPoint);
  const goalKey  = gridKey(goalPoint);
  
  const pathKeys = findPathBFS(startKey, goalKey, grid);
  if (pathKeys === null) {
    if (debug) {
      console.log("No valid path found!");
    }
    return;
  }
  
  if (debug) {
    console.log("BFS path found:", pathKeys);
    drawSolutionPath(pathKeys, grid, bot);
    setInterval(() => updatePlayerMarker(bot), 200);
  }
  
  await followBFSPath(pathKeys, grid, bot);
  
};
