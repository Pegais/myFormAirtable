/*
    this file contains the logic for the conditional logic rules;
    evaluate wether a question should be shown based on the rules;
    this is pure function-no side effects, no UI dependencies
    */

/**
 * Evaluating a single conditional rule;
 * @param {Object} rule - the rule to evaluate;
 * @param {Object} answers - the answers to evaluate the rule against;
 * @returns {boolean} - true if the rule is met, false otherwise;
 */
const evaluateConditionalRule = (rule, answers) => {
      //getting the answer for the question this condtion checks;
      const answerValue = answers[rule.questionKey];
      //if answer is not found, return false;
     if(answerValue === undefined || answerValue === null) return false;

     const {operator,value} = rule;
     switch(operator){
        case 'equals':
            //strict check for equality;
            return answerValue === value;
        case 'doesNotEqual':
        case 'notEquals':    //strict check for inequality;
            return answerValue !== value;
        case 'contains':
                    //check for strings and arrays;
            if(Array.isArray(answerValue)){
                //for multi select fields
                return answerValue.includes(value);
            }else if(typeof answerValue === 'string'){
                //for string check if string contains substring;
                return answerValue.toLowerCase().includes(String(value).toLowerCase());
            }else{
                return false;
            }
        default:
            // console.warn(`Unsupported operator: ${operator}`);
            return false;
     }
            
}

/**
 * determining if a question should be shown based on the rules;
 * @param {Object|null} rules - the rule to evaluate;
 * @param {Object} answers - the answers to evaluate the rule against;
 * @returns {boolean} - true if the question should be shown, false otherwise;
 */
const shouldShowQuestion = (rules, answers) => {
    //if no rules , always show the question;
    if(!rules ||!rules.conditions || rules.conditions.length === 0) return true;
    

    //if answer is empty or undefined,check if any condtions are met;
    if(!answers){
        answers = {};
    }
    const {logic,conditions} = rules;

    //evaluating all conditons;
    const results =conditions.map(condition => evaluateConditionalRule(condition, answers));

    //combine results based on logic;
    if(logic === 'OR') {

        //showing if any condition is met;
        return results.some(result => result===true);
    }
    else{
        //default to AND logic;
       return results.every(result => result===true);
    } 
   
   
}

module.exports = {
    evaluateConditionalRule,
    shouldShowQuestion
}