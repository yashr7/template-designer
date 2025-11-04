# main.py
import os
import re
import json
import shutil
import tempfile
import subprocess
from pathlib import Path
from dotenv import load_dotenv

from starlette.applications import Starlette
from starlette.routing import Route
from starlette.responses import JSONResponse, PlainTextResponse, FileResponse
from starlette.middleware import Middleware
from starlette.middleware.cors import CORSMiddleware

load_dotenv()

# Basic paths
BASE_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = BASE_DIR / "uploads"
RULES_DIR = BASE_DIR / "rules"
CONVERTERS_DIR = BASE_DIR / "converters"

for d in (UPLOAD_DIR, RULES_DIR, CONVERTERS_DIR):
    d.mkdir(parents=True, exist_ok=True)

# OpenAI client (openai v1.x)
from openai import OpenAI
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if not OPENAI_API_KEY:
    print("Warning: OPENAI_API_KEY not set - /rules/generate will fail without it.")
client = OpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY else None

# utils
from utils.xml_to_dict import xml_file_to_dict
from utils.html_tags import extract_placeholders
from utils.node_runner import run_js_rule

# Simple helpers
def safe_tag_name(tag: str) -> str:
    # keep letters, numbers and underscore
    return re.sub(r'[^0-9A-Za-z_]', '_', tag)

# ROUTES

async def root(request):
    return JSONResponse({"message": "Template Rules Backend running"})

# Upload endpoint - accepts multipart form with two files: html and thml(xml)
async def upload_files(request):
    form = await request.form()
    html_file = form.get("html")
    xml_file = form.get("xml")

    if not html_file or not xml_file:
        return JSONResponse({"success": False, "error": "Both html and xml files required (fields: html, xml)."}, status_code=400)

    # Save files
    html_path = UPLOAD_DIR / "sample.html"
    xml_path = UPLOAD_DIR / "sample-thml.xml"

    with open(html_path, "wb") as f:
        f.write(await html_file.read())

    with open(xml_path, "wb") as f:
        f.write(await xml_file.read())

    return JSONResponse({"success": True, "html_path": str(html_path), "xml_path": str(xml_path)})

# Return list of placeholders and classification (static/dynamic)
async def get_tags(request):
    html_path = UPLOAD_DIR / "sample.html"
    xml_path = UPLOAD_DIR / "sample-thml.xml"

    if not html_path.exists() or not xml_path.exists():
        return JSONResponse({"success": False, "error": "Uploaded files not found. Use /upload first."}, status_code=400)

    html = html_path.read_text(encoding="utf-8")
    placeholders = extract_placeholders(html)  # list like ['CandidateName', 'OfferSummary', ...]

    xml_data = xml_file_to_dict(xml_path)
    result = []
    for tag in placeholders:
        result.append({
            "tag": tag,
            "type": "static" if tag in xml_data else "dynamic",
            "value": xml_data.get(tag) if tag in xml_data else None,
            "rule_exists": (RULES_DIR / f"rule_{safe_tag_name(tag)}.js").exists()
        })

    return JSONResponse({"success": True, "placeholders": result})

# Generate rule: call OpenAI with prompt + xml sample and save returned JS function as rule file
async def generate_rule(request):
    if client is None:
        return JSONResponse({"success": False, "error": "OpenAI key not configured on server."}, status_code=500)

    body = await request.json()
    tag = body.get("tag")              # e.g., "OfferSummary"
    prompt = body.get("prompt")        # user prompt describing how to compute the tag
    example_limit = int(body.get("example_limit", 10))

    if not tag or not prompt:
        return JSONResponse({"success": False, "error": "tag and prompt are required"}, status_code=400)

    html_path = UPLOAD_DIR / "sample.html"
    xml_path = UPLOAD_DIR / "sample-thml.xml"

    if not xml_path.exists():
        return JSONResponse({"success": False, "error": "XML file not uploaded"}, status_code=400)

    # Prepare context: sample xml data (small subset)
    xml_data = xml_file_to_dict(xml_path)
    sample_data = {k: xml_data[k] for i,k in enumerate(xml_data) if i < example_limit}

    # Build system + user prompts
    system_prompt = (
        "You are a JavaScript code generator. Generate a single JavaScript function named "
        f"'generate_{tag}' that accepts one argument 'data' (an object) and returns a string value "
        "for the template placeholder. Use only JavaScript. Do NOT include ANY markdown or explanation. "
        "Function should be robust (handle missing properties) and return a string. Example: "
        "function generate_X(data) { try { return data.X || ''; } catch(e) { return ''; } }"
    )

    user_prompt = (
        f"Tag: {tag}\n"
        f"Prompt: {prompt}\n\n"
        "XML sample data (JSON):\n"
        f"{json.dumps(sample_data, indent=2)}\n\n"
        "Generate the JS function now."
    )

    try:
        response = client.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.0,
            max_tokens=800
        )
        generated_code = response.choices[0].message.content.strip()

        # Clean code fences if present
        if generated_code.startswith("```"):
            parts = generated_code.split("```")
            if len(parts) >= 2:
                generated_code = parts[1].strip()
                # drop language if present
                if generated_code.startswith("javascript") or generated_code.startswith("js"):
                    generated_code = "\n".join(generated_code.split("\n")[1:])

        # Save as executable Node script wrapper:
        safe = safe_tag_name(tag)
        rule_filename = RULES_DIR / f"rule_{safe}.js"

        # Create a wrapper that exports the function and also allows execution via stdin (JSON)
        # If generated_code already defines function generate_<tag>, we wrap it
        wrapper = f"""// Auto-generated rule for tag: {tag}
// Saved at: {rule_filename.name}
{generated_code}

// Runner: read JSON from stdin, call the function and print result
const fs = require('fs');
async function run() {{
  try {{
    let input = '';
    process.stdin.setEncoding('utf8');
    for await (const chunk of process.stdin) input += chunk;
    const data = JSON.parse(input || '{{}}');
    // Try multiple candidate function names
    const fnNames = ['generate_{tag}', 'generate{tag}', 'generate_{safe}', 'generate{safe}'];
    let fn = null;
    for (const n of fnNames) {{
      if (typeof global[n] === 'function') fn = global[n];
      if (typeof eval(n) === 'function') fn = eval(n);
      if (fn) break;
    }}
    // as fallback try function named generate_TagName
    if (!fn && typeof generate === 'function') fn = generate;
    if (!fn) {{
      // try to find any function defined in file and use it
      const keys = Object.getOwnPropertyNames(global).filter(k => typeof global[k] === 'function');
      if (keys.length) {{
        fn = global[keys[keys.length-1]];
      }}
    }}
    if (!fn) {{
      console.error("No function found in rule file for tag {tag}");
      process.exit(2);
    }}
    const out = await Promise.resolve(fn(data));
    if (typeof out === 'object') {{
      console.log(JSON.stringify(out));
    }} else {{
      console.log(String(out === undefined || out === null ? '' : out));
    }}
  }} catch (e) {{
    console.error("ERROR_RUNNING_RULE:", e && e.message ? e.message : String(e));
    process.exit(3);
  }}
}}
run();
"""
        rule_filename.write_text(wrapper, encoding="utf-8")
        return JSONResponse({"success": True, "rule_file": str(rule_filename), "generated_code": generated_code})

    except Exception as e:
        return JSONResponse({"success": False, "error": str(e)}, status_code=500)

# Test rule: run saved JS with current XML data and return computed value
async def test_rule(request):
    body = await request.json()
    tag = body.get("tag")
    if not tag:
        return JSONResponse({"success": False, "error": "tag required"}, status_code=400)
    safe = safe_tag_name(tag)
    rule_file = RULES_DIR / f"rule_{safe}.js"
    xml_path = UPLOAD_DIR / "sample-thml.xml"
    if not rule_file.exists():
        return JSONResponse({"success": False, "error": f"Rule file not found: {rule_file.name}"}, status_code=404)
    if not xml_path.exists():
        return JSONResponse({"success": False, "error": "XML file not uploaded"}, status_code=400)

    data = xml_file_to_dict(xml_path)
    try:
        out = run_js_rule(rule_file, data, timeout=10)
        return JSONResponse({"success": True, "value": out})
    except Exception as e:
        return JSONResponse({"success": False, "error": str(e)}, status_code=500)

# Render document: fill static tags and run dynamic rules (for all dynamic placeholders)
async def render_document(request):
    html_path = UPLOAD_DIR / "sample.html"
    xml_path = UPLOAD_DIR / "sample-thml.xml"
    if not html_path.exists() or not xml_path.exists():
        return JSONResponse({"success": False, "error": "Uploaded files not found. Use /upload first."}, status_code=400)

    html = html_path.read_text(encoding="utf-8")
    xml_data = xml_file_to_dict(xml_path)
    placeholders = extract_placeholders(html)

    filled = html
    for tag in placeholders:
        placeholder = f"/*{tag}*/"
        if tag in xml_data:
            filled = filled.replace(placeholder, xml_data[tag])
        else:
            # dynamic rule expected
            safe = safe_tag_name(tag)
            rule_file = RULES_DIR / f"rule_{safe}.js"
            if not rule_file.exists():
                filled = filled.replace(placeholder, f"[MISSING_RULE:{tag}]")
                continue
            try:
                value = run_js_rule(rule_file, xml_data, timeout=10)
                filled = filled.replace(placeholder, value)
            except Exception as e:
                filled = filled.replace(placeholder, f"[RULE_ERROR:{tag}]")

    return JSONResponse({"success": True, "html": filled})

# Convert document to PDF (requires wkhtmltopdf + pdfkit)
async def document_to_pdf(request):
    body = await request.json()
    html_content = body.get("html")
    if not html_content:
        return JSONResponse({"success": False, "error": "html required in body"}, status_code=400)

    try:
        # Use a temp file
        tmp_html = tempfile.NamedTemporaryFile(delete=False, suffix=".html", mode="w", encoding="utf-8")
        tmp_html.write(html_content)
        tmp_html.close()
        pdf_path = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf").name

        # import here to keep requirements optional
        import pdfkit
        pdfkit.from_file(tmp_html.name, pdf_path)
        # return file response
        return FileResponse(pdf_path, media_type="application/pdf", filename="document.pdf")
    except Exception as e:
        return JSONResponse({"success": False, "error": f"PDF conversion failed: {str(e)}"}, status_code=500)

# route list
routes = [
    Route("/", root),
    Route("/upload", upload_files, methods=["POST"]),
    Route("/tags", get_tags, methods=["GET"]),
    Route("/rules/generate", generate_rule, methods=["POST"]),
    Route("/rules/test", test_rule, methods=["POST"]),
    Route("/document/render", render_document, methods=["POST"]),
    Route("/document/pdf", document_to_pdf, methods=["POST"]),
]

middleware = [
    Middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
]

app = Starlette(routes=routes, middleware=middleware)
