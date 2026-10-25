import { serveAI } from '../shared/vs';
import { computerMove, rules } from './board';

serveAI(rules, computerMove);
