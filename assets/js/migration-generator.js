function generateMigrationCode(modelName, tableName, fields, includeSoftDeletes) {
    // Filter only belongsTo relations and regular fields
    const migrationFields = fields.filter(f => 
        f.type !== 'relation' || 
        (f.type === 'relation' && f.relationshipType === 'belongsTo')
    );

    let code = `<?php\n\nuse Illuminate\\Database\\Migrations\\Migration;\nuse Illuminate\\Database\\Schema\\Blueprint;\nuse Illuminate\\Support\\Facades\\Schema;\n\nreturn new class extends Migration\n{\n    /**\n     * Run the migrations.\n     */\n    public function up(): void\n    {\n        Schema::create('${tableName}', function (Blueprint $table) {\n            $table->id();\n`;
    
    migrationFields.forEach(field => {
        if (field.type === 'relation') {
            let line = `            $table->foreignId('${field.foreignKey || field.relatedModel.toLowerCase() + '_id'}')`;
            
            if (field.nullable) {
                line += '->nullable()';
            }
            
            if (field.hasDefault && field.defaultValue !== undefined) {
                line += `->default('${field.defaultValue}')`;
            }
            
            line += `->constrained('${field.relatedTable || field.relatedModel.toLowerCase()}')`;
            
            if (field.onDeleteNull) {
                line += '->nullOnDelete()';
            } else if (field.onDeleteCascade) {
                line += '->cascadeOnDelete()';
            }
            
            line += ';';
            code += line + '\n';
        } else {
            const fieldType = field.type === 'file' ? 'string' : field.type;
            let line = `            $table->${fieldType}('${field.name}')`;
            
            if ((fieldType === 'string' || fieldType === 'decimal') && field.length) {
                if (fieldType === 'decimal' && field.precision) {
                    line += `(${field.length}, ${field.precision})`;
                } else {
                    const length = fieldType === 'string' ? (field.length || 255) : field.length;
                    line += `(${length})`;
                }
            }
            
            if (fieldType === 'enum' && field.enumValues) {
                const values = field.enumValues.split(',').map(v => `'${v.trim()}'`).join(', ');
                line = `            $table->enum('${field.name}', [${values}])`;
            }
            
            if (field.nullable) {
                line += '->nullable()';
            }
            
            if (field.unique) {
                line += '->unique()';
            }
            
            if (field.index) {
                line += '->index()';
            }
            
            if (field.hasDefault && field.defaultValue !== undefined) {
                let defaultValue = field.defaultValue;
                
                if (fieldType === 'boolean') {
                    defaultValue = defaultValue.toLowerCase() === 'true' ? 'true' : 'false';
                } else if (fieldType === 'integer' || fieldType === 'float' || fieldType === 'decimal') {
                    // Use as-is for numbers
                } else {
                    defaultValue = `'${defaultValue}'`;
                }
                
                line += `->default(${defaultValue})`;
            }
            
            line += ';';
            code += line + '\n';
        }
    });
    
    if (includeSoftDeletes) {
        code += '            $table->softDeletes();\n';
    }
    
    code += `            $table->timestamps();\n        });\n    }\n\n    /**\n     * Reverse the migrations.\n     */\n    public function down(): void\n    {\n        Schema::dropIfExists('${tableName}');\n    }\n};`;
    
    return code;
}