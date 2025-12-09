import { Buffer } from 'buffer';
import process from 'process';

if (typeof window !== 'undefined') {
    window.Buffer = window.Buffer || Buffer;
    window.process = window.process || process;
}

if (typeof global !== 'undefined') {
    global.Buffer = global.Buffer || Buffer;
    global.process = global.process || process;
}
