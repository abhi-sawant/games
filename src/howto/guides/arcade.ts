import type { Guide } from '../guides';
import { grid } from '../art';

export const arcade: Record<string, Guide> = {
  qubo: {
    name: 'Qubo',
    ink: 'cocoa',
    goal: 'Time your jumps from tower to tower for as long as you can.',
    steps: [
      'The cube stands on a tower that slowly tips toward the next one, faster and faster.',
      'Tap to throw the cube off the top, the way the tower is leaning. Land on the next tower for <b>1 point</b>.',
      'Tap too early and it falls short; too late and the tower goes over with the cube. Hitting the side of a tower ends the run too.',
      'Each new tower tips a little faster, and the towers get narrower. Your best score is saved.',
    ],
    controls: [
      '<b>Tap</b>, click or press <b>Space</b> to jump. The first tap only starts the tower tipping.',
    ],
    tips: [
      'The more the tower leans when you tap, the farther the cube flies. Wide gaps need a later tap.',
      'The cube also keeps the speed the tower is tipping at, so a late tap throws it farther than the lean alone.',
    ],
    example: {
      html: grid(5, ['cube|on small', '', '', '', 'tower|small'], 44),
      caption: 'Tap when the tower leans enough to reach the next one.',
    },
  },
  racer: {
    name: 'Road Racer',
    ink: 'cocoa',
    goal: 'Drive as far as you can, dodging the traffic, until you hit a car.',
    steps: [
      'Your car drives by itself. You only choose which lane it is in.',
      'Cars and trucks come down the road. Move out of their way. Every row of traffic leaves at least one lane free.',
      'Every few seconds the road gets a little faster. You score a point for every stretch of road you cover.',
      'Hitting a car ends the run. Your best score is saved for each level.',
    ],
    controls: [
      '<b>Tap</b> the left or right half of the board, or press <b>←</b> / <b>→</b> (or <b>A</b> / <b>D</b>), to move one lane. The first tap starts the run.',
      'Choose Country Road, Highway, City Rush or Night Rally: later levels have more lanes, more traffic and a higher top speed.',
    ],
    tips: [
      'Look at the gaps two rows ahead, not just the car in front.',
      'Staying in a middle lane gives you room to go either way.',
    ],
    example: {
      html: grid(3, ['', 'rival|coral small', '', '', '', '', '', 'car|on small', ''], 44),
      caption: 'Tap left or right to slip into a free lane.',
    },
  },
  dirtbike: {
    name: 'Dirt Bike',
    ink: 'cocoa',
    goal: 'Race to the finish line as fast as you can, staying ahead of the rivals.',
    steps: [
      'Every race starts from the line: you and the rivals wait on the grid for 3, 2, 1, then go. Hold the gas to ride, and add turbo to go faster. The engine heats up and stalls for a moment if it gets too hot.',
      'Ride up a <b>ramp</b> in your lane to jump. The bike leaves the lip nose-up and the nose drifts, so lean to bring it level before you land: a flat landing even gives a little speed, a sloppy one costs speed, and a bad one throws you off.',
      'Riders can fall. A <b>hay bale</b>, a bad landing or running into another rider throws you off the bike: you get up, climb back on and carry on from a standstill, but the clock keeps running. <b>Mud</b> slows you down. The rivals fall too, on bales or when they run into each other, so a fallen rider on the track is in your way.',
      'Teal arrows on the track cool the engine. Your finish time is your score, and your best time is saved for each difficulty. Easy has a short track and a couple of slower rivals; Medium and Hard have longer tracks, more and faster rivals, and an engine that overheats sooner.',
    ],
    controls: [
      'Hold <b>→</b> (or <b>D</b>) for gas and <b>Space</b> for turbo. Press <b>↑</b> / <b>↓</b> (or <b>W</b> / <b>S</b>) to change lane.',
      'In the air, <b>←</b> leans back (nose up) and <b>→</b> leans forward (nose down). On a touch screen, use the buttons under the board.',
    ],
    tips: [
      'Use turbo in short bursts and let the engine cool between them.',
      'Aim to be level just before the wheels touch down. Short taps of → or ← work better than holding them.',
    ],
    example: {
      html: grid(3, ['', '', '', 'bike|on small', '', 'bale|yellow small', '', '', ''], 44),
      caption: 'Stay in your lane for the ramp, or move over to dodge the bale.',
    },
  },
  crazycat: {
    name: 'Crazy Cat',
    ink: 'cocoa',
    goal: 'Run as far as you can, jumping the obstacles and catching fish, until you hit one.',
    steps: [
      'The cat runs by itself. You only decide when to jump.',
      'Clear a crate to score <b>1 point</b>, and catch a fish for <b>2 points</b>.',
      'Tap again in the air for a higher jump.',
      'Running into an obstacle ends the run. Your best score is saved for each speed.',
    ],
    controls: [
      '<b>Tap</b>, click or press <b>Space</b> to jump. Do it again in the air to jump higher.',
      'Choose Kitten, Tabby or Crazy to set the speed.',
    ],
    tips: [
      'Jump a little early. A tap is not instant, so give the cat time to rise.',
      'Use the second jump to clear tall obstacles or to reach a fish up high.',
    ],
    example: {
      html: grid(5, ['cat|on small round', '', 'crate|coral small', 'fish|yellow small round', ''], 44),
      caption: 'Jump over the crate for a point, and catch the fish for two.',
    },
  },
};
