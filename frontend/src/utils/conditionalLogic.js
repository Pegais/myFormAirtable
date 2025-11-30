/**
 * Evaluating a single conditional rule;
 */


const evaluateConditionalRule = (rule, answers) => {
    const answerValue = answers[rule.questionKey];
    if(answerValue === undefined || answerValue === null) return false;

    const {operator,value} = rule;
    switch(operator){
        case 'equals':
            return answerValue === value;
        case 'doesNotEqual':
        case 'notEquals':
            return answerValue !== value;
        case 'contains':
            if(Array.isArray(answerValue)){
                return answerValue.includes(value);
            }else if(typeof answerValue === 'string'){
                return answerValue.toLowerCase().includes(String(value).toLowerCase());
            }
            return false;
        default:
            console.warn(`Unsupported operator: ${operator}`);
            return false;
    }
};


/**
 * Determining if a  question should be shown based on the rules;
 * 
 */

export const shouldShowQuestion = (rules, answers) => {
    if(!rules ||!rules.conditions || rules.conditions.length === 0) return true;
    if(!answers){
        answers = {};
    }
    const {logic,conditions} = rules;

    //evaluating all conditons;
    const results = conditions.map(condition => evaluateConditionalRule(condition, answers));

    //combine results based on logic;
    if(logic === 'OR'){
        return results.some(result => result===true);
    }else{
        return results.every(result => result===true);
    }

};