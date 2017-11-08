$('document').ready(function()
{ 
     /* validation */
	 $("#login_form").validate({
      rules:
	  {
			text: {
            required: true
            },
            
            number: {
                required: true,
                number: true
                },
	   },
       messages:
	   {
            lastname:{
                      required: "(ex. Mocorro / Mocorro Jr / Mocorro III)"
                     },
            employee_id: "Enter your valid Employee number (ex. 12345)",
       },
	   submitHandler: submitForm	
       });  
	   /* validation */
	   
	   /* login submit */
	   function submitForm()
	   {		
			var data = $("#login_form").serialize();
			
			$.ajax({
				
			type : 'POST',
			url  : '/login/validate', // api url
			data : data,
			beforeSend: function()
			{	
				$("#error").fadeOut();
				$("#btn-login").prop("disabled",true);
				$("#btn-login").html('sending ...');
			},
			success :  function(response)
			   {						
					if(response=="ok"){

						$("#btn-login").html('Logging in...');
						$("#btn-login").prop("disabled",true);
						setTimeout(' window.location.href = "/home"; ',3000);
					}
					else{
									
						$("#error").fadeIn(1000, function(){						
							$("#error").html('<div class="alert alert-danger">'+response+' </div>');
							
							let counter = 10;
							let interval = setInterval(function(){
								counter--;
								$("#btn-login").html('Please wait in ' + counter + ' secs');

								if(counter !== 1){
									$("#btn-login").html('Please wait in ' + counter + ' secs');
								} else {
									$("#btn-login").html('Please wait in ' + counter + ' sec');
									clearInterval(interval);
								}
							},	1000);

							setTimeout(function(){
								$("#btn-login").prop("disabled",false);
								$("#btn-login").html('Try again');
							}, counter +'000');
							
							
                        });
                        
                        $("#employee_id").click(function() {
                            $(this).closest('form').find("input[type=text], textarea").val("");
                        });
					}
			  }
			});
				return false;
		}
	   /* login submit */	  
	   
});