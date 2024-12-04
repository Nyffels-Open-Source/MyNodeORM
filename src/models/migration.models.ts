export abstract class MigrationFileBuilder {
    public static GetFileTemplate() {
        return `
            export abstract class MigrationFile {
                public static Up() {
                    {{{{TEMPLATE-DATA-UP}}}}
                }
                
                public static Down() {
                    {{{{TEMPLATE-DATA-DOWN}}}}
                }
            }
        `;
    }
}