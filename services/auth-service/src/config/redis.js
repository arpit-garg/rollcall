import net from "node:net";
import { env } from "./env.js";

const redisUrl = new URL(env.redisUrl);
const redisHost = redisUrl.hostname;
const redisPort = Number(redisUrl.port || 6379);
const redisDatabase = Number(redisUrl.pathname.replace("/", "") || "0");

function encodeCommand(args) {
  return (
    `*${args.length}\r\n` +
    args
      .map((arg) => {
        const value = String(arg);
        return `$${Buffer.byteLength(value)}\r\n${value}\r\n`;
      })
      .join("")
  );
}

function parseResponse(buffer) {
  if (buffer.length === 0) {
    return null;
  }

  const lineEnd = buffer.indexOf("\r\n");

  if (lineEnd === -1) {
    return null;
  }

  const prefix = String.fromCharCode(buffer[0]);
  const line = buffer.subarray(1, lineEnd).toString();

  if (prefix === "+") {
    return {
      value: line,
      consumed: lineEnd + 2
    };
  }

  if (prefix === "-") {
    const error = new Error(line);
    error.isRedisError = true;
    return {
      error,
      consumed: lineEnd + 2
    };
  }

  if (prefix === ":") {
    return {
      value: Number(line),
      consumed: lineEnd + 2
    };
  }

  if (prefix === "$") {
    const payloadLength = Number(line);

    if (payloadLength === -1) {
      return {
        value: null,
        consumed: lineEnd + 2
      };
    }

    const payloadStart = lineEnd + 2;
    const payloadEnd = payloadStart + payloadLength;

    if (buffer.length < payloadEnd + 2) {
      return null;
    }

    return {
      value: buffer.subarray(payloadStart, payloadEnd).toString(),
      consumed: payloadEnd + 2
    };
  }

  throw new Error(`Unsupported Redis response prefix: ${prefix}`);
}

export async function runRedisCommands(commands) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({
      host: redisHost,
      port: redisPort
    });

    let responsesExpected = commands.length + (redisDatabase > 0 ? 1 : 0);
    let responses = [];
    let pendingBuffer = Buffer.alloc(0);
    let settled = false;

    function finishWithError(error) {
      if (settled) {
        return;
      }

      settled = true;
      socket.destroy();
      reject(error);
    }

    socket.on("connect", () => {
      if (redisDatabase > 0) {
        socket.write(encodeCommand(["SELECT", redisDatabase]));
      }

      for (const command of commands) {
        socket.write(encodeCommand(command));
      }
    });

    socket.on("data", (chunk) => {
      pendingBuffer = Buffer.concat([pendingBuffer, chunk]);

      while (true) {
        const parsed = parseResponse(pendingBuffer);

        if (!parsed) {
          return;
        }

        pendingBuffer = pendingBuffer.subarray(parsed.consumed);

        if (parsed.error) {
          finishWithError(parsed.error);
          return;
        }

        responses.push(parsed.value);

        if (responses.length === responsesExpected) {
          if (!settled) {
            settled = true;
            socket.end();
            resolve(redisDatabase > 0 ? responses.slice(1) : responses);
          }

          return;
        }
      }
    });

    socket.on("error", finishWithError);

    socket.on("end", () => {
      if (!settled) {
        finishWithError(new Error("Redis connection closed before all responses were received"));
      }
    });
  });
}
