function generateModelCode(modelName, modelNamespace, fields, includeSoftDeletes) {
    // Filter fillable fields - exclude relations
    const fillableFields = fields.filter(f => 
        f.fillable !== false && 
        f.type !== 'relation'
    ).map(f => `'${f.name}'`);
    
    let fillable = fillableFields.join(",\n        ");
    
    // Filter cast fields
    const castFields = fields.filter(f => f.cast);
    let casts = '';
    if (castFields.length > 0) {
        casts = `\n    protected \$casts = [\n`;
        casts += castFields.map(f => `        '${f.name}' => '${f.castType}'`).join(",\n");
        casts += '\n    ];\n';
    }
    
    // File paths for file fields
    let filePaths = '';
    const fileFields = fields.filter(f => f.type === 'file');
    if (fileFields.length > 0) {
        filePaths = '\n    // File paths\n';
        fileFields.forEach(field => {
            const constName = field.name.toUpperCase() + '_PATH';
            filePaths += `    public const ${constName} = '${field.filePath || 'public/uploads'}${field.filePath && !field.filePath.endsWith('/') ? '/' : ''}';\n`;
        });
    }
    
    // Soft deletes
    let softDeletesImport = '';
    let softDeletesTrait = '';
    if (includeSoftDeletes) {
        softDeletesImport = 'use Illuminate\\Database\\Eloquent\\SoftDeletes;\n';
        softDeletesTrait = '    use SoftDeletes;\n\n';
    }
    
    // Generate all relationships
    let relations = '';
    const relationFields = fields.filter(f => f.type === 'relation');
    const usedForeignKeys = new Set(); // Track used foreign keys to prevent duplicates
    
    if (relationFields.length > 0) {
        relations = '\n    // Relationships\n';
        relationFields.forEach(field => {
            const relatedModel = field.relatedModel;
            const relatedModelLower = relatedModel.toLowerCase();
            const foreignKey = field.foreignKey || relatedModelLower + '_id';
            
            switch(field.relationshipType) {
                case 'hasMany':
                    // Pluralize the related model name for hasMany
                    const hasManyName = (field.name || relatedModelLower) + 's';
                    relations += `    public function ${hasManyName}()\n    {\n        return $this->hasMany(${relatedModel}::class);\n    }\n\n`;
                    break;
                    
                case 'hasOne':
                    // Singular for hasOne
                    const hasOneName = field.name || relatedModelLower;
                    relations += `    public function ${hasOneName}()\n    {\n        return $this->hasOne(${relatedModel}::class);\n    }\n\n`;
                    break;
                    
                case 'belongsToMany':
                    // Pluralize for belongsToMany
                    const belongsToManyName = (field.name || relatedModelLower) + 's';
                    const pivotTable = [modelName.toLowerCase(), relatedModelLower].sort().join('_');
                    relations += `    public function ${belongsToManyName}()\n    {\n        return $this->belongsToMany(${relatedModel}::class, '${pivotTable}');\n    }\n\n`;
                    break;
                    
                case 'morphTo':
                    relations += `    public function ${field.name}()\n    {\n        return $this->morphTo();\n    }\n\n`;
                    break;
                    
                case 'morphMany':
                    relations += `    public function ${field.name}()\n    {\n        return $this->morphMany(${relatedModel}::class, '${field.name}_type');\n    }\n\n`;
                    break;
                    
                default: // belongsTo
                    // Only create relationship if foreign key hasn't been used yet
                    if (!usedForeignKeys.has(foreignKey)) {
                        // Use the related model name in singular form for the method name
                        const belongsToName = relatedModelLower.replace(/_id$/, '');
                        relations += `    public function ${belongsToName}()\n    {\n        return $this->belongsTo(${relatedModel}::class, '${foreignKey}');\n    }\n\n`;
                        usedForeignKeys.add(foreignKey);
                    }
            }
        });
    }
    
    let code = `<?php\n\nnamespace ${modelNamespace};\n\nuse Illuminate\\Database\\Eloquent\\Model;\n${softDeletesImport}\nclass ${modelName} extends Model\n{\n${softDeletesTrait}    protected \$table = '${modelName.toLowerCase()}s';\n    \n    protected \$fillable = [\n        ${fillable}\n    ];${casts}${filePaths}${relations}`;
    
    // Add file handling methods if there are file fields
    if (fileFields.length > 0) {
        fileFields.forEach(field => {
            const methodName = field.name.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
            const constName = field.name.toUpperCase() + '_PATH';
            
            code += `\n\n    public function get${methodName.charAt(0).toUpperCase() + methodName.slice(1)}UrlAttribute()\n    {\n        return \$this->${field.name} ? asset(self::${constName} . \$this->${field.name}) : null;\n    }`;
        });
    }
    
    code += '\n}';
    
    return code;
}
