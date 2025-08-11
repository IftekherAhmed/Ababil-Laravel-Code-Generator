function generateControllerCode(modelName, tableName, modelNamespace, controllerNamespace, baseController, fields, includeAuthMiddleware) {
    const fileFields = fields.filter(f => f.type === 'file');
    const regularFields = fields.filter(f => f.type !== 'relation');
    
    const validationRules = generateValidationRules([...regularFields, ...fields.filter(f => 
        f.type === 'relation' && f.relationshipType === 'belongsTo'
    )]);
    
    const fillableFieldsCode = generateFillableFieldsCode(regularFields, modelName);

    let code = `<?php

namespace ${controllerNamespace};

use ${modelNamespace}\\${modelName};
use Illuminate\\Http\\Request;
use Illuminate\\Support\\Facades\\File;

class ${modelName}Controller extends ${baseController}
{
    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        $${modelName.toLowerCase()}s = ${modelName}::all();
        return view('${modelName.toLowerCase()}.index', compact('${modelName.toLowerCase()}s'));
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create()
    {
        return view('${modelName.toLowerCase()}.create');
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request \$request)
    {
        \$this->validateRequest(\$request);
        
        try {
            \$${modelName.toLowerCase()} = new ${modelName}();
            \$this->fillRequestData(\$request, \$${modelName.toLowerCase()});\n`;

    fileFields.forEach(field => {
        code += `            \$this->handle${field.name.charAt(0).toUpperCase() + field.name.slice(1)}(\$request, \$${modelName.toLowerCase()});\n`;
    });

    code += `            \$${modelName.toLowerCase()}->save();
            return redirect()->route('${modelName.toLowerCase()}s.index')->with('success', '${modelName} created successfully.');
        } catch (\\Exception \$e) {
            return back()->with('error', \$e->getMessage())->withInput();
        }
    }

    /**
     * Display the specified resource.
     */
    public function show(${modelName} \$${modelName.toLowerCase()})
    {
        return view('${modelName.toLowerCase()}.show', compact('${modelName.toLowerCase()}'));
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit(${modelName} \$${modelName.toLowerCase()})
    {
        return view('${modelName.toLowerCase()}.edit', compact('${modelName.toLowerCase()}'));
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request \$request, string \$id)
    {
        \$${modelName.toLowerCase()} = ${modelName}::find(\$id);
        if (!\$${modelName.toLowerCase()}) {
            return back()->with('error', '${modelName} not found');
        }

        \$this->validateRequest(\$request);
        
        try {
            \$this->fillRequestData(\$request, \$${modelName.toLowerCase()});\n`;

    fileFields.forEach(field => {
        code += `            \$this->handle${field.name.charAt(0).toUpperCase() + field.name.slice(1)}(\$request, \$${modelName.toLowerCase()});\n`;
    });

    code += `            \$${modelName.toLowerCase()}->update();
            return redirect()->route('${modelName.toLowerCase()}s.index')->with('success', '${modelName} updated successfully.');
        } catch (\\Exception \$e) {
            return back()->with('error', \$e->getMessage())->withInput();
        }
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(${modelName} \$${modelName.toLowerCase()})
    {
        try {\n`;

    fileFields.forEach(field => {
        code += `            \$this->delete${field.name.charAt(0).toUpperCase() + field.name.slice(1)}(\$${modelName.toLowerCase()});\n`;
    });

    code += `            \$${modelName.toLowerCase()}->delete();
            return redirect()->route('${modelName.toLowerCase()}s.index')->with('success', '${modelName} deleted successfully.');
        } catch (\\Exception \$e) {
            return back()->with('error', \$e->getMessage());
        }
    }

    private function validateRequest(Request \$request)
    {
        \$request->validate([\n${validationRules}        ]);
    }

    private function fillRequestData(Request \$request, \$${modelName.toLowerCase()})
    {${fillableFieldsCode}
    }\n`;

    fileFields.forEach(field => {
        const fieldName = field.name.charAt(0).toUpperCase() + field.name.slice(1);
        const pathConst = field.name.toUpperCase() + '_PATH';
        
        code += `
    private function handle${fieldName}(Request \$request, \$${modelName.toLowerCase()})
    {
        if (\$request->hasFile('${field.name}')) {
            \$this->delete${fieldName}(\$${modelName.toLowerCase()});
            \$fileName = time().'_'.uniqid().'.'.\$request->file('${field.name}')->extension();
            \$request->file('${field.name}')->move(${modelName}::${pathConst}, \$fileName);
            \$${modelName.toLowerCase()}->${field.name} = \$fileName;
        }
    }

    private function delete${fieldName}(\$${modelName.toLowerCase()})
    {
        if (\$${modelName.toLowerCase()}->${field.name}) {
            \$filePath = ${modelName}::${pathConst}.\$${modelName.toLowerCase()}->${field.name};
            if (file_exists(\$filePath)) {
                unlink(\$filePath);
            }
        }
    }\n`;
    });

    code += `}`;
    return code;
}

function generateValidationRules(fields) {
    let rules = '';
    fields.forEach(field => {
        if (['id', 'created_at', 'updated_at'].includes(field.name)) return;
        
        let rule = `'${field.name}' => '`;
        let validations = [];
        
        switch (field.type) {
            case 'string': 
                validations.push('string', field.length ? `max:${field.length}` : '');
                break;
            case 'text': validations.push('string'); break;
            case 'integer': validations.push('integer'); break;
            case 'boolean': validations.push('boolean'); break;
            case 'date': validations.push('date'); break;
            case 'datetime': validations.push('date'); break;
            case 'file':
                validations.push('file', `mimes:${field.allowedTypes || 'jpg,jpeg,png,webp,gif,svg'}`, 
                    `max:${(field.maxFileSize || 5) * 1024}`);
                break;
            case 'enum':
                if (field.enumValues) {
                    validations.push(`in:${field.enumValues.split(',').map(v => v.trim()).filter(v => v).join(',')}`);
                }
                break;
            case 'relation':
                if (field.relationshipType === 'belongsTo') {
                    validations.push('exists:' + (field.relatedTable || field.relatedModel.toLowerCase()) + ',id');
                }
                break;
        }
        
        if (!field.nullable) validations.unshift('required');
        rule += validations.filter(v => v).join('|') + "'";
        rules += `            ${rule},\n`;
    });
    return rules;
}

function generateFillableFieldsCode(fields, modelName) {
    let code = '';
    fields.forEach(field => {
        if (!['id', 'created_at', 'updated_at'].includes(field.name)) {
            code += `\n        \$${modelName.toLowerCase()}->${field.name} = \$request->${field.name};`;
        }
    });
    return code;
}