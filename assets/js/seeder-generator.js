function generateSeederCode(modelName, fields) {
    // Filter out system fields and get only fillable fields
    const fillableFields = fields.filter(f => 
        !['id', 'created_at', 'updated_at'].includes(f.name) && 
        f.fillable !== false
    );

    const hasRelations = fields.some(f => f.type === 'relation');
    
    // Generate Faker data for each field
    const fakerFields = fillableFields.map(f => {
        if (f.type === 'relation') {
            const relatedModel = f.relatedModel || 'RelatedModel';
            return `'${f.name}' => $faker->randomElement(${relatedModel.toLowerCase()}Ids),`;
        }
        
        let fakerMethod = '';
        switch(f.type) {
            case 'string':
                if (f.name.includes('name')) fakerMethod = 'name';
                else if (f.name.includes('email')) fakerMethod = 'unique()->safeEmail';
                else if (f.name.includes('phone')) fakerMethod = 'phoneNumber';
                else if (f.name.includes('address')) fakerMethod = 'address';
                else if (f.name.includes('city')) fakerMethod = 'city';
                else if (f.name.includes('country')) fakerMethod = 'country';
                else if (f.name.includes('title') || f.name.includes('subject')) fakerMethod = 'sentence';
                else fakerMethod = 'word';
                break;
            case 'text': fakerMethod = 'paragraph'; break;
            case 'integer': 
            case 'bigInteger':
                if (f.name.includes('age')) fakerMethod = 'numberBetween(18, 65)';
                else if (f.name.includes('quantity') || f.name.includes('count')) fakerMethod = 'numberBetween(1, 100)';
                else fakerMethod = 'randomNumber()';
                break;
            case 'boolean': fakerMethod = 'boolean'; break;
            case 'date': fakerMethod = 'date()'; break;
            case 'datetime': fakerMethod = 'dateTime()'; break;
            case 'decimal': 
            case 'float': 
                fakerMethod = 'randomFloat(2, 1, 1000)'; 
                break;
            case 'enum':
                if (f.enumValues) {
                    const values = f.enumValues.split(',').map(v => `'${v.trim()}'`).join(', ');
                    return `'${f.name}' => $faker->randomElement([${values}]),`;
                }
                fakerMethod = 'word';
                break;
            default: fakerMethod = 'word';
        }
        
        return `'${f.name}' => $faker->${fakerMethod},`;
    }).join('\n            ');

    // Get all related models for imports
    const relatedModels = [...new Set(fields
        .filter(f => f.type === 'relation')
        .map(f => f.relatedModel || 'RelatedModel')
    )];

    const relatedImports = relatedModels.length > 0 ? 
        `\nuse App\\Models\\${relatedModels.join(';\nuse App\\Models\\')};` : 
        '';

    const relatedIds = relatedModels.length > 0 ? 
        `\n${relatedModels.map(m => `        $${m.toLowerCase()}Ids = ${m}::pluck('id')->toArray();`).join('\n')}` : 
        '';

    let code = `<?php

namespace Database\\Seeders;

use App\\Models\\${modelName};${relatedImports}
use Faker\\Factory as Faker;
use Illuminate\\Database\\Seeder;

class ${modelName}Seeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {        
        $faker = Faker::create();${relatedIds}
        
        foreach (range(1, 10) as $index) {
            ${modelName}::create([
                ${fakerFields}
            ]);
        }
    }
}`;

    return code;
}