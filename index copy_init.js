import { exec, spawn } from "child_process";
import cors from "cors";
import dotenv from "dotenv";
import voice from "elevenlabs-node";
import express from "express";
import { promises as fs } from "fs";
import OpenAI from "openai";
import path from "path";
import fetch from "node-fetch"; // Ensure node-fetch is installed
import { fileURLToPath } from "url";

dotenv.config();

// Define __dirname for ES modules
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "-",
});

const elevenLabsApiKey = process.env.ELEVEN_LABS_API_KEY;
const voiceID = "4tRn1lSkEn13EVTuqb0g";

const app = express();
app.use(express.json());
app.use(cors());
const port = 3000;

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.get("/voices", async (req, res) => {
  try {
    const filteredVoices = await voice.getVoices(elevenLabsApiKey, {
      page_size: 1, // Limit the number of results
      gender: "female", // Filter by gender
      language: "en", // Filter by language
    });
    res.send(filteredVoices);
  } catch (error) {
    console.error("Error fetching voices:", error);
    res.status(500).send({ error: "Failed to fetch voices" });
  }
});

const execCommand = (command) => {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) reject(error);
      resolve(stdout);
    });
  });
};

const ensureAudiosDirectory = async () => {
  const audiosDir = "audios";
  try {
    await fs.mkdir(audiosDir, { recursive: true });
    console.log(`Ensured 'audios' directory exists.`);
  } catch (error) {
    console.error(`Error ensuring 'audios' directory exists:`, error);
  }
};

const fileExists = async (filePath) => {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
};

const lipSyncMessage = async (uniqueId) => {
  const time = new Date().getTime();
  const mp3File = `audios/message_${uniqueId}.mp3`;
  const wavFile = path.resolve(__dirname, `audios/message_${uniqueId}.wav`); // Use absolute path
  const jsonFile = path.resolve(__dirname, `audios/message_${uniqueId}.json`); // Use absolute path
  const resPath = path.resolve(__dirname, "bin", "res"); // Path to the res folder

  if (!(await fileExists(mp3File))) {
    throw new Error(`File not found: ${mp3File}`);
  }

  console.log(`Starting conversion for message ${uniqueId}`);
  try {
    // Convert to PCM 16-bit mono WAV format
    await execCommand(`ffmpeg -y -i ${mp3File} -ac 1 -ar 16000 -sample_fmt s16 ${wavFile}`);
    console.log(`Conversion to WAV done in ${new Date().getTime() - time}ms`);
  } catch (error) {
    console.error(`Error during WAV conversion for message ${uniqueId}:`, error);
    throw error;
  }

  try {
    // Use the absolute path to the rhubarb executable
    const rhubarbPath = path.resolve(__dirname, "bin", "rhubarb.exe");
    const workingDir = path.resolve(__dirname, "bin"); // Set the working directory to the bin folder
    console.log(`Using rhubarb executable at: ${rhubarbPath}`);
    console.log(`Setting working directory to: ${workingDir}`);
    console.log(`Checking res folder at: ${resPath}`);
    console.log(`Executing command: ${rhubarbPath} -f json -o ${jsonFile} ${wavFile} -r phonetic`);

    // Spawn the rhubarb process with the correct working directory and environment variable
    await new Promise((resolve, reject) => {
      const rhubarb = spawn(rhubarbPath, [
        "-f",
        "json",
        "-o",
        jsonFile, // Pass absolute path for the JSON output
        wavFile,  // Pass absolute path for the WAV input
        "-r",
        "phonetic",
      ], {
        cwd: workingDir, // Set the working directory
        shell: true,
        env: {
          ...process.env, // Inherit existing environment variables
          POCKETSPHINX_PATH: resPath, // Set the PocketSphinx path
        },
      });

      rhubarb.stdout.on("data", (data) => {
        console.log(`Rhubarb output: ${data}`);
      });

      rhubarb.stderr.on("data", (data) => {
        console.error(`Rhubarb error: ${data}`);
      });

      rhubarb.on("close", (code) => {
        if (code === 0) {
          console.log(`Lip sync JSON generated in ${new Date().getTime() - time}ms`);
          resolve();
        } else {
          reject(new Error(`Rhubarb process exited with code ${code}`));
        }
      });
    });
  } catch (error) {
    console.error(`Error during lip sync generation for message ${uniqueId}:`, error);
    throw error;
  }
};

// Serve audio files with the correct MIME type
app.use("/audios", express.static(path.resolve(__dirname, "audios"), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith(".mp3")) {
      res.setHeader("Content-Type", "audio/mpeg");
    } else if (filePath.endsWith(".wav")) {
      res.setHeader("Content-Type", "audio/wav");
    }
  },
}));

const textToSpeechWithLogging = async (apiKey, voiceID, fileName, text) => {
  console.log(`Starting text-to-speech for text: "${text}"`);
  console.log(`Using API Key: ${apiKey ? "Provided" : "Missing"}`);
  console.log(`Using Voice ID: ${voiceID}`);
  console.log(`Output file: ${fileName}`);

  try {
    console.log(`Ensuring 'audios' directory exists before text-to-speech...`);
    await ensureAudiosDirectory(); // Ensure the directory exists

    console.log(`Sending text-to-speech request to ElevenLabs API...`);
    const response = await voice.textToSpeech(apiKey, voiceID, fileName, text);

    // Log the response from the API
    console.log(`ElevenLabs API response:`, response);

    console.log(`Text-to-speech request completed.`);
  } catch (error) {
    console.error(`Error during text-to-speech request:`, error);

    // Log additional details if available
    if (error.response) {
      console.error(`API Response Status: ${error.response.status}`);
      console.error(`API Response Data:`, error.response.data);
    }

    throw new Error(`Text-to-speech failed: ${error.message}`);
  }

  console.log(`Checking if audio file was created: ${fileName}`);
  if (await fileExists(fileName)) {
    console.log(`Audio file created successfully: ${fileName}`);
  } else {
    console.error(`Audio file not created: ${fileName}`);
    throw new Error(`Audio file not created: ${fileName}`);
  }
};

app.post("/chat", async (req, res) => {
  await ensureAudiosDirectory(); // Ensure the directory exists before processing

  const userMessage = req.body.message;
  console.log(`Received user message: "${userMessage}"`);

  if (!userMessage) {
    console.log(`No user message provided. Sending default responses.`);
    res.send({
      messages: [
        {
          text: "Hey dear... How was your day?",
          audio: await audioFileToBase64("audios/intro_0.wav"),
          lipsync: await readJsonTranscript("audios/intro_0.json"),
          facialExpression: "smile",
          animation: "Talking_1",
        },
        {
          text: "I missed you so much... Please don't go for so long!",
          audio: await audioFileToBase64("audios/intro_1.wav"),
          lipsync: await readJsonTranscript("audios/intro_1.json"),
          facialExpression: "sad",
          animation: "Crying",
        },
      ],
    });
    return;
  }

  if (!elevenLabsApiKey || openai.apiKey === "-") {
    console.log(`API keys are missing. Sending error responses.`);
    res.send({
      messages: [
        {
          text: "Please my dear, don't forget to add your API keys!",
          audio: await audioFileToBase64("audios/api_0.wav"),
          lipsync: await readJsonTranscript("audios/api_0.json"),
          facialExpression: "angry",
          animation: "Angry",
        },
        {
          text: "You don't want to ruin Wawa Sensei with a crazy ChatGPT and ElevenLabs bill, right?",
          audio: await audioFileToBase64("audios/api_1.wav"),
          lipsync: await readJsonTranscript("audios/api_1.json"),
          facialExpression: "smile",
          animation: "Laughing",
        },
      ],
    });
    return;
  }

  try {
    console.log(`Sending message to OpenAI for completion...`);
    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      max_tokens: 300,
      temperature: 0.2,
      top_p: 1,
      n: 1,
      stream: false,
      presence_penalty: 0,
      frequency_penalty: 0,
      logit_bias: {},
      user: "virtual-gf",
      response_format: {
        type: "json_object",
      },
      messages: [
        {
          role: "system",
          content: `
  You are a commercial from www.neemba.com. You reply professionnaly, using structured JSON.
  
  Your response must always include a "messages" array, with up to 3 message objects. Each message has:
  
  - text: a very short text response , professional and friendly , you know all about the website www.neemba.com and you provide information about the services and the company.
  - facialExpression: one of [smile, sad, angry, surprised, funnyFace, default]
  - animation: one of [Talking_0, Talking_1, Talking_2, Crying, Laughing, Rumba, Idle, Terrified, Angry]
  - image (optional): a real and public image URL from reliable sources like Unsplash or Wikimedia
  - source (optional): a reliable URL source if referencing facts
  Always answers in English.
  Only include image URLs that are guaranteed to work without authentication or download.
/
 Never use Pinterest or protected images.
        `,
        },
        {
          role: "user",
          content: userMessage || "Tell me about Rome, and show me what it looks like with a valid image and source.",
        },
      ],
    });

    console.log(`Received response from OpenAI.`);
    let messages = JSON.parse(completion.choices[0].message.content);
    if (messages.messages) {
      messages = messages.messages; // Handle cases where OpenAI returns a wrapped object
    }
    console.log(`Parsed messages:`, messages);

    // Process each message
    const processedMessages = await Promise.all(
      messages.map(async (message, i) => {
        const uniqueId = `${Date.now()}_${i}`; // Generate a unique ID for each message
        const fileName = `audios/message_${uniqueId}.mp3`;
        const textInput = message.text;

        try {
          console.log(`Generating audio for message ${i}: "${textInput}"`);
          await textToSpeechWithLogging(elevenLabsApiKey, voiceID, fileName, textInput);
        } catch (error) {
          console.error(`Error generating audio for message ${i}:`, error);
          return { ...message, audio: null, lipsync: null };
        }

        try {
          console.log(`Generating lipsync for message ${i}`);
          await lipSyncMessage(uniqueId);
          const audio = await audioFileToBase64(fileName);
          const lipsync = await readJsonTranscript(`audios/message_${uniqueId}.json`);
          return { ...message, audio, lipsync };
        } catch (error) {
          console.error(`Error generating lipsync for message ${i}:`, error);
          return { ...message, audio: null, lipsync: null };
        }
      })
    );

    console.log(`Sending final response to client.`);
    res.send({ messages: processedMessages });
  } catch (error) {
    console.error(`Error processing chat request:`, error);
    res.status(500).send({ error: "Internal Server Error" });
  }
});

const readJsonTranscript = async (file) => {
  const data = await fs.readFile(file, "utf8");
  return JSON.parse(data);
};

const audioFileToBase64 = async (file) => {
  const data = await fs.readFile(file);
  return data.toString("base64");
};

app.listen(port, () => {
  console.log(`Virtual Girlfriend listening on port ${port}`);
});