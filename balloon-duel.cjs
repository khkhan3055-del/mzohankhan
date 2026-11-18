const { randomInt, randomBytes } = require('node:crypto');

const rooms = new Map();
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const maxRooms = 150;
const maxBody = 110_000;
const roomLifetime = 25 * 60_000;
const roundLength = 45_000;
const balloonInterval = 660;
const flightTime = 4100;
const comboWindow = 10_000;

setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) {
    if (room.expires <= now) rooms.delete(code);
  }
}, 60_000).unref();

function send(response, code, data) {
  response.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  }).end(JSON.stringify(data));
}

async function readBody(request) {
  if (!/^application\/json(?:;|$)/i.test(request.headers['content-type'] ?? '')) {
    throw Object.assign(new Error('Expected a JSON request.'), {status: 415});
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of request.iterator({destroyOnReturn:false})) {
    size += chunk.length;
    if (size > maxBody) {
      request.resume();
      throw Object.assign(new Error('That photo is too large.'), {status: 413});
    }
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString()); }
  catch { throw Object.assign(new Error('Invalid request.'), {status: 400}); }
}

function validPhoto(photo) {
  if (typeof photo !== 'string' || photo.length > 105_000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(photo)) return false;
  const image = Buffer.from(photo, 'base64');
  return image.length >= 4 && image[0] === 0xff && image[1] === 0xd8 &&
    image.at(-2) === 0xff && image.at(-1) === 0xd9;
}

function player(photo) {
  return {token:randomBytes(24).toString('base64url'), photo, hits:new Set(), score:0, correct:0, combo:0, bestCombo:0, lastCorrect:0, ready:false};
}

function createLineup() {
  const lineup = [];
  const count = Math.ceil(roundLength / balloonInterval);
  while (lineup.length < count) {
    const remaining = Math.min(10, count - lineup.length);
    const pairs = Math.floor(remaining / 3);
    const block = Array.from({length:remaining}, (_, i) => i < pairs * 2 ? i % 2 : 2 + (i - pairs * 2) % 4);
    for (let i = block.length - 1; i > 0; i--) {
      const j = randomInt(i + 1);
      [block[i], block[j]] = [block[j], block[i]];
    }
    lineup.push(...block.slice(0, count - lineup.length));
  }
  return lineup;
}

function snapshot(room, index) {
  const opponent = room.players[1 - index];
  return {
    code:room.code, start:room.start, now:Date.now(), round:room.round,
    duration:roundLength, interval:balloonInterval, flight:flightTime, lineup:room.lineup ?? [],
    connected:Boolean(opponent), ready:room.players.map(member => member.ready), index,
    scores:room.players.map(member => member.score),
    stats:room.players.map(member => ({
      correct:member.correct, attempts:member.hits.size, bestCombo:member.bestCombo,
      combo:Date.now() - member.lastCorrect <= comboWindow ? member.combo : 0
    }))
  };
}

async function handleDuel(request, response, path) {
  try {
    if (request.headers['sec-fetch-site'] === 'cross-site') return send(response, 403, {error:'Open the game on Zohan’s World.'});
    if (request.method === 'POST' && path === '/api/duel') {
      const {photo} = await readBody(request) ?? {};
      if (!validPhoto(photo)) return send(response, 400, {error:'Choose a valid photo first.'});
      if (rooms.size >= maxRooms) return send(response, 503, {error:'The arena is full. Try again in a few minutes.'});
      let code;
      do {
        code = Array.from({length:6}, () => alphabet[randomInt(alphabet.length)]).join('');
      } while (rooms.has(code));
      const host = player(photo);
      rooms.set(code, {code, players:[host], start:0, round:0, expires:Date.now()+roomLifetime});
      return send(response, 201, {code, token:host.token});
    }

    const match = /^\/api\/duel\/([A-Z2-9]{6})(?:\/(join|pop|ready|photo|leave))?$/.exec(path);
    if (!match) return send(response, 404, {error:'Room not found.'});
    const [,code, action] = match;
    const room = rooms.get(code);
    if (!room || room.expires <= Date.now()) return send(response, 404, {error:'That room has expired or does not exist.'});

    if (request.method === 'POST' && action === 'join') {
      const {photo} = await readBody(request) ?? {};
      if (!validPhoto(photo)) return send(response, 400, {error:'Choose a valid photo first.'});
      if (room.players.length === 2) return send(response, 409, {error:'This room already has two players.'});
      const guest = player(photo);
      room.players.push(guest);
      return send(response, 200, {code, token:guest.token});
    }

    const index = room.players.findIndex(member => 'Bearer ' + member.token === request.headers.authorization);
    if (index === -1) return send(response, 403, {error:'Join the room before playing.'});
    if (request.method === 'POST' && action === 'leave') {
      rooms.delete(code);
      return send(response, 200, {closed:true});
    }
    if (request.method === 'GET' && !action) return send(response, 200, snapshot(room, index));
    if (request.method === 'GET' && action === 'photo') {
      return send(response, 200, {photo:room.players[1-index]?.photo ?? null});
    }
    if (request.method === 'POST' && action === 'ready') {
      const now = Date.now();
      if (room.players.length !== 2 || (room.start && now < room.start + roundLength)) {
        return send(response, 409, {error:'Wait until both players are here and the current round is over.'});
      }
      room.players[index].ready = true;
      if (room.players.every(member => member.ready)) {
        for (const member of room.players) {
          member.hits.clear();
          member.score = member.correct = member.combo = member.bestCombo = member.lastCorrect = 0;
          member.ready = false;
        }
        room.lineup = createLineup();
        room.round++;
        room.start = now + 3500;
        room.expires = now + roomLifetime;
      }
      return send(response, 200, snapshot(room, index));
    }
    if (request.method === 'POST' && action === 'pop') {
      const {balloon, round} = await readBody(request) ?? {};
      const age = Date.now() - room.start - balloon * balloonInterval;
      const member = room.players[index];
      if (!room.start || round !== room.round || !Number.isSafeInteger(balloon) || balloon < 0 ||
          balloon >= room.lineup.length || Date.now() > room.start + roundLength + 350 || age < -120 || age > flightTime + 350) {
        return send(response, 409, {error:'That balloon is out of play.'});
      }
      const target = room.lineup[balloon];
      const isOpponent = target === 1 - index;
      let points = 0;
      let multiplier = 1;
      if (!member.hits.has(balloon)) {
        member.hits.add(balloon);
        if (isOpponent) {
          const now = Date.now();
          member.combo = now - member.lastCorrect <= comboWindow ? member.combo + 1 : 1;
          member.lastCorrect = now;
          member.correct++;
          member.bestCombo = Math.max(member.bestCombo, member.combo);
          multiplier = Math.min(3, 1 + Math.floor(member.combo / 3));
          points = (balloon % 7 === 6 ? 3 : 1) * multiplier;
          member.score += points;
        } else {
          member.combo = 0;
        }
      }
      return send(response, 200, {
        ...snapshot(room, index),
        pop: {points, multiplier, kind:isOpponent ? 'friend' : target === index ? 'you' : 'cartoon'}
      });
    }
    return send(response, 405, {error:'Method not allowed.'});
  } catch (error) {
    return send(response, error.status ?? 500, {error:error.status ? error.message : 'The room request did not complete.'});
  }
}

module.exports = { handleDuel };
