from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, Any
import openai
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = FastAPI(title="Dynamic Template Editor API")

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173", "http://127.0.0.1:3000", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize OpenAI client
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if not OPENAI_API_KEY:
    print("Warning: OPENAI_API_KEY not found in environment variables")
    openai.api_key = None
else:
    openai.api_key = OPENAI_API_KEY

# Request Models
class GenerateRuleRequest(BaseModel):
    prompt: str
    field_name: str
    context: Optional[Dict[str, Any]] = None

class TestRuleRequest(BaseModel):
    code: str
    field_name: str
    thml_data: Optional[Dict[str, Any]] = None

# Response Models
class GenerateRuleResponse(BaseModel):
    generated_code: str
    field_name: str
    success: bool

class TestRuleResponse(BaseModel):
    result: Any
    success: bool
    error: Optional[str] = None

# API Endpoints
@app.get("/")
async def root():
    return {
        "message": "Dynamic Template Editor API",
        "version": "1.0.0",
        "endpoints": {
            "/api/rules/generate": "POST - Generate code from prompt",
            "/api/rules/test": "POST - Test generated code",
            "/health": "GET - Health check"
        }
    }

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "openai_configured": openai.api_key is not None
    }

@app.post("/api/rules/generate", response_model=GenerateRuleResponse)
async def generate_rule(request: GenerateRuleRequest):
    """
    Generate JavaScript code from natural language prompt using OpenAI GPT
    """
    if not openai.api_key:
        raise HTTPException(
            status_code=500,
            detail="OpenAI API key not configured. Please set OPENAI_API_KEY environment variable."
        )
    
    try:
        # Create the system prompt
        system_prompt = """You are a JavaScript code generator for a template filling system. 
Your task is to generate a JavaScript function that processes data from THML (Theological Markup Language) files.

Rules:
1. Generate ONLY the function code, no explanations, no markdown
2. Function name MUST be: generate_{field_name}
3. The function should be self-contained and return a value
4. Use a mock fetchFromTHML(tagName) function to get data from THML files
5. Include proper error handling
6. Return strings, numbers, or formatted values as appropriate
7. Keep code clean and efficient
8. DO NOT wrap code in markdown code blocks

Example THML data structure:
{
  "CompanyName": "Acme Corp",
  "Salary": "10000",
  "EmployeeName": "John Doe",
  "StartDate": "2024-01-01"
}

Example prompt: "Calculate annual salary by fetching Salary tag and multiplying by 12"
Example output:
function generate_AnnualSalary() {
  try {
    const monthlySalary = parseFloat(fetchFromTHML("Salary"));
    if (isNaN(monthlySalary)) return "N/A";
    return (monthlySalary * 12).toLocaleString('en-US', {style: 'currency', currency: 'USD'});
  } catch (e) {
    return "Error calculating salary";
  }
}

Generate ONLY the JavaScript function code, nothing else."""

        # Create user prompt
        user_prompt = f"""Field name: {request.field_name}
Prompt: {request.prompt}

Generate the JavaScript function now."""

        # Call OpenAI API
        response = openai.chat.completions.create(
            model="gpt-4",  # or "gpt-3.5-turbo" for faster/cheaper option
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.3,
            max_tokens=2048
        )
        
        # Extract generated code
        generated_code = response.choices[0].message.content.strip()
        
        # Clean up the response (remove markdown code blocks if present)
        if generated_code.startswith("```"):
            lines = generated_code.split("\n")
            # Remove first and last lines (``` markers)
            generated_code = "\n".join(lines[1:-1]) if len(lines) > 2 else generated_code
            # Remove language identifier if present
            if generated_code.startswith("javascript") or generated_code.startswith("js"):
                generated_code = "\n".join(generated_code.split("\n")[1:])
        
        generated_code = generated_code.strip()
        
        return GenerateRuleResponse(
            generated_code=generated_code,
            field_name=request.field_name,
            success=True
        )
        
    except openai.OpenAIError as e:
        raise HTTPException(
            status_code=500,
            detail=f"OpenAI API error: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error generating code: {str(e)}"
        )

@app.post("/api/rules/test", response_model=TestRuleResponse)
async def test_rule(request: TestRuleRequest):
    """
    Test generated JavaScript code (simulation)
    Note: Actual execution happens in the frontend
    """
    try:
        # In production, you might want to use a JavaScript runtime
        # For now, we just validate the code structure
        
        if not request.code or len(request.code.strip()) == 0:
            raise HTTPException(
                status_code=400,
                detail="Code cannot be empty"
            )
        
        # Basic validation
        if f"generate_{request.field_name}" not in request.code:
            return TestRuleResponse(
                result=None,
                success=False,
                error=f"Function generate_{request.field_name} not found in code"
            )
        
        return TestRuleResponse(
            result="Code validation passed. Execute in frontend for actual results.",
            success=True,
            error=None
        )
        
    except Exception as e:
        return TestRuleResponse(
            result=None,
            success=False,
            error=str(e)
        )

# THML Processing Endpoints
@app.post("/api/thml/parse")
async def parse_thml(content: str):
    """
    Parse THML content and extract tags (placeholder for future implementation)
    """
    try:
        # This is a placeholder - implement actual THML parsing as needed
        return {
            "success": True,
            "message": "THML parsing not yet implemented",
            "data": {}
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error parsing THML: {str(e)}"
        )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)