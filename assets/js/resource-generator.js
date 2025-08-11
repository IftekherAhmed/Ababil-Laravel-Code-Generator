function generateResourceCode(modelName, fields) {
    const resourceFields = fields
        .filter(f => !['id', 'created_at', 'updated_at'].includes(f.name))
        .map(f => `'${f.name}' => \$this->${f.name},`)
        .join('\n            ');

    return `<?php

namespace App\\Http\\Resources;

use Illuminate\\Http\\Resources\\Json\\JsonResource;

class ${modelName}Resource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @param  \\Illuminate\\Http\\Request  \$request
     * @return array
     */
    public function toArray(\$request)
    {
        return [
            ${resourceFields}
        ];
    }
}`;
}